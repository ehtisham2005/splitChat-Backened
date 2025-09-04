const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');

// Create Group
exports.createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;

    // Always add creator as a member too
    const group = await Group.create({
      name,
      members: [...new Set([req.user.id, ...(members || [])])],
      createdBy: req.user.id,
    });

    await group.populate("members", "name email");

    res.json({ message: "Group created successfully", group });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Groups of logged-in user
exports.getGroups = async (req, res) => {
  try {
    const groups = await Group.find({
      $or: [
        { members: req.user.id },
        { createdBy: req.user.id }
      ]
    })
      .populate('members', 'name email')
      .populate('expenses')
      .populate('chats')
      .populate('createdBy', 'name email');

    res.json({ count: groups.length, groups });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Group (only creator)
exports.updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only creator can update the group" });
    }

    if (name) group.name = name;
    await group.save();

    await group.populate("members", "name email");

    res.json({ message: "Group updated successfully", group });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Group (only creator)
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only creator can delete the group" });
    }

    await group.deleteOne();
    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add Member
exports.addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.members.includes(userId)) {
      return res.status(400).json({ message: "User already in group" });
    }

    group.members.push(userId);
    await group.save();

    await group.populate("members", "name email");

    res.json({ message: "Member added successfully", group });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove Member
exports.removeMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Prevent removing creator
    if (group.createdBy.toString() === userId) {
      return res.status(400).json({ message: "Creator cannot be removed from the group" });
    }

    // Only creator can remove others (but user can remove self)
    if (group.createdBy.toString() !== req.user.id && req.user.id !== userId) {
      return res.status(403).json({ message: "Not authorized to remove this member" });
    }

    group.members = group.members.filter(
      (memberId) => memberId.toString() !== userId
    );
    await group.save();

    await group.populate("members", "name email");

    res.json({ message: "Member removed successfully", group });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
