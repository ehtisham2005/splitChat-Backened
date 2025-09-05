const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');

/** Safe emit helper */
function emitToRoomFromReq(req, room, eventName, payload) {
  try {
    const io = req.app && req.app.locals && req.app.locals.io;
    if (!io) return;
    io.to(room.toString()).emit(eventName, payload);
  } catch (e) {
    console.error('emit error', e.message);
  }
}

/** Create Group */
exports.createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    // unique member ids (ensure valid ObjectIds)
    const safeMembers = Array.isArray(members) ? [...new Set(members.filter(m => mongoose.Types.ObjectId.isValid(m)))] : [];
    const creatorId = req.user.id;

    // Always add creator as a member too
    const group = await Group.create({
      name: name.trim(),
      members: [...new Set([creatorId, ...safeMembers])],
      createdBy: creatorId,
    });

    await group.populate('members', 'name email');

    // Emit group creation to creator (or to a room if you want)
    // We can emit to each member if they are connected: iterate members
    try {
      const io = req.app && req.app.locals && req.app.locals.io;
      if (io && group.members && group.members.length) {
        group.members.forEach(m => {
          io.to(m._id.toString()).emit('group:new', { group });
        });
      }
    } catch (e) {
      console.error('group create emit error', e.message);
    }

    res.status(201).json({ message: 'Group created successfully', group });
  } catch (error) {
    console.error('createGroup', error);
    res.status(500).json({ message: error.message });
  }
};

/** Get Groups of logged-in user */
exports.getGroups = async (req, res) => {
  try {
    const groups = await Group.find({
      $or: [{ members: req.user.id }, { createdBy: req.user.id }],
    })
      .populate('members', 'name email')
      .populate('expenses')
      .populate('chats')
      .populate('createdBy', 'name email');

    res.json({ count: groups.length, groups });
  } catch (error) {
    console.error('getGroups', error);
    res.status(500).json({ message: error.message });
  }
};

/** Update Group (only creator) */
exports.updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only creator can update the group' });
    }

    if (name && typeof name === 'string' && name.trim()) group.name = name.trim();
    await group.save();
    await group.populate('members', 'name email');

    // emit update to group room
    emitToRoomFromReq(req, groupId, 'group:update', { group });

    res.json({ message: 'Group updated successfully', group });
  } catch (error) {
    console.error('updateGroup', error);
    res.status(500).json({ message: error.message });
  }
};

/** Delete Group (only creator) */
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only creator can delete the group' });
    }

    await group.deleteOne();

    // emit deletion to room (clients subscribed to groupId)
    emitToRoomFromReq(req, groupId, 'group:delete', { groupId });

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('deleteGroup', error);
    res.status(500).json({ message: error.message });
  }
};

/** Add Member */
exports.addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid group or user ID' });
    }

    const user = await User.findById(userId).select('name email');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Only allow creator to add others (or allow members? current policy: creator-only)
    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only creator can add members' });
    }

    if (group.members.some(m => m.toString() === userId)) {
      return res.status(400).json({ message: 'User already in group' });
    }

    group.members.push(userId);
    await group.save();

    await group.populate('members', 'name email');

    // emit to the new member and to group
    try {
      const io = req.app && req.app.locals && req.app.locals.io;
      if (io) {
        // notify new member directly if connected
        io.to(userId.toString()).emit('group:member:add', { group, user });
        // notify group room that a member was added
        io.to(groupId.toString()).emit('group:member:added', { groupId, user: { _id: user._id, name: user.name, email: user.email } });
      }
    } catch (e) {
      console.error('emit addMember error', e.message);
    }

    res.json({ message: 'Member added successfully', group });
  } catch (error) {
    console.error('addMember', error);
    res.status(500).json({ message: error.message });
  }
};

/** Remove Member */
exports.removeMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid group or user ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Prevent removing creator
    if (group.createdBy && group.createdBy.toString() === userId) {
      return res.status(400).json({ message: 'Creator cannot be removed from the group' });
    }

    // Only creator can remove others (but user can remove self)
    if (group.createdBy.toString() !== req.user.id && req.user.id !== userId) {
      return res.status(403).json({ message: 'Not authorized to remove this member' });
    }

    if (!group.members.some(m => m.toString() === userId)) {
      return res.status(400).json({ message: 'User is not a member of this group' });
    }

    group.members = group.members.filter(memberId => memberId.toString() !== userId);
    await group.save();

    await group.populate('members', 'name email');

    // emits
    try {
      const io = req.app && req.app.locals && req.app.locals.io;
      if (io) {
        io.to(groupId.toString()).emit('group:member:removed', { groupId, userId });
        io.to(userId.toString()).emit('group:member:removed:you', { groupId });
      }
    } catch (e) {
      console.error('emit removeMember error', e.message);
    }

    res.json({ message: 'Member removed successfully', group });
  } catch (error) {
    console.error('removeMember', error);
    res.status(500).json({ message: error.message });
  }
};
