const Chat = require('../models/Chat');
const Group = require('../models/Group');

/**
 * Ensure the requester is a member of the group.
 * Returns { ok: true, group } or { ok: false, code, msg }
 */
async function ensureMember(groupId, userId) {
  const group = await Group.findById(groupId).select('members');
  if (!group) return { ok: false, code: 404, msg: 'Group not found' };
  const isMember = group.members.some(m => m.toString() === userId.toString());
  if (!isMember) return { ok: false, code: 403, msg: 'Not authorized for this group' };
  return { ok: true, group };
}

/**
 * GET /api/chats/:groupId?page=&limit=
 * List messages for a group (newest first by default)
 */
exports.getChats = async (req, res) => {
  try {
    const { groupId } = req.params;
    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10), 1), 100);
    const skip  = (page - 1) * limit;

    // membership check
    const guard = await ensureMember(groupId, req.user._id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.msg });

    const [items, total] = await Promise.all([
      Chat.find({ group: groupId })
        .sort({ createdAt: -1 })          // newest → oldest
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name email') // safe fields only
        .lean(),
      Chat.countDocuments({ group: groupId }),
    ]);

    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/chats/:groupId
 * Create/send a message to a group.
 * Body: { message: string }
 */
exports.createChat = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message } = req.body;

    // membership check
    const guard = await ensureMember(groupId, req.user._id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.msg });

    const chat = await Chat.create({
      group: groupId,
      sender: req.user._id,   // <- from JWT (prevents spoofing)
      message,
    });

    // (optional) also push to group's chats array if you keep refs there
    await Group.findByIdAndUpdate(groupId, { $push: { chats: chat._id } });

    const populated = await chat.populate([
      { path: 'sender', select: 'name email' },
      { path: 'group',  select: 'name' },
    ]);

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/chats/:chatId
 * Edit a message (only the original sender can edit)
 * Body: { message: string }
 */
exports.updateChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // ownership check
    if (chat.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the sender can edit this message' });
    }

    // still a member?
    const guard = await ensureMember(chat.group, req.user._id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.msg });

    if (message) chat.message = message;
    await chat.save();

    const populated = await chat.populate('sender', 'name email');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/chats/:chatId
 * Delete a message (only the original sender can delete)
 */
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // ownership check
    if (chat.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the sender can delete this message' });
    }

    // still a member?
    const guard = await ensureMember(chat.group, req.user._id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.msg });

    await chat.deleteOne();

    // (optional) also pull from group's chats array if you keep refs there
    await Group.findByIdAndUpdate(chat.group, { $pull: { chats: chat._id } });

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
