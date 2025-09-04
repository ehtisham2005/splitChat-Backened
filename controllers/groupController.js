const Group = require('../models/Group');
const User = require('../models/User');

// ✅ Create Group
exports.createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const group = await Group.create({ name, members });
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get All Groups
exports.getGroups = async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('members')
      .populate('expenses')
      .populate('chats');
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Add Member to Group
exports.addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    // Check if group exists
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Prevent duplicates
    if (group.members.includes(userId)) {
      return res.status(400).json({ message: "User already in group" });
    }

    group.members.push(userId);
    await group.save();

    res.json(await group.populate("members"));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Remove Member from Group
exports.removeMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    group.members = group.members.filter(
      (memberId) => memberId.toString() !== userId
    );
    await group.save();

    res.json(await group.populate("members"));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
