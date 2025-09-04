const Expense = require('../models/Expense');
const Group = require('../models/Group');

//
// ✅ Debt Simplification Helper
//
function simplifyDebts(balances) {
  let debtors = [];
  let creditors = [];

  for (let [userId, balance] of Object.entries(balances)) {
    if (balance < 0) debtors.push({ userId, amount: -balance });
    else if (balance > 0) creditors.push({ userId, amount: balance });
  }

  let transactions = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    let debtor = debtors[i];
    let creditor = creditors[j];

    let settled = Math.min(debtor.amount, creditor.amount);

    transactions.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: Number(settled.toFixed(2)),
    });

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transactions;
}

//
// ➕ Add Expense
//
exports.addExpense = async (req, res) => {
  try {
    const { description, amount, paidBy, group, splitBetween } = req.body;

    // Check group existence
    const groupDoc = await Group.findById(group).populate('members', '_id');
    if (!groupDoc) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Ensure requester is a group member
    if (!groupDoc.members.some(m => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to add expenses in this group' });
    }

    // Ensure paidBy is member of group
    if (!groupDoc.members.some(m => m._id.toString() === paidBy)) {
      return res.status(400).json({ message: 'Payer is not a member of this group' });
    }

    // Ensure all splitBetween are members
    const invalidUsers = splitBetween.filter(
      u => !groupDoc.members.some(m => m._id.toString() === u)
    );
    if (invalidUsers.length > 0) {
      return res.status(400).json({ message: 'Some users are not members of this group' });
    }

    const expense = await Expense.create({
      description,
      amount,
      paidBy,
      group,
      splitBetween,
    });

    const populatedExpense = await expense
      .populate('paidBy', 'name email')
      .populate('splitBetween', 'name email');

    res.status(201).json(populatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//
// 📖 Get all expenses for a group
//
exports.getExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Ensure user is a member
    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to view expenses of this group' });
    }

    const expenses = await Expense.find({ group: groupId })
      .populate('paidBy', 'name email')
      .populate('splitBetween', 'name email');

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//
// ✅ Settle Expenses with Debt Simplification
//
exports.settleExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate('members', 'name email');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(m => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to view settlement of this group' });
    }

    const expenses = await Expense.find({ group: groupId })
      .populate('paidBy', 'name email')
      .populate('splitBetween', 'name email');

    if (!expenses.length) {
      return res.status(404).json({ message: 'No expenses found for this group' });
    }

    // Track balances
    const balances = {};
    const userMap = {};

    expenses.forEach(expense => {
      const splitAmount = expense.amount / expense.splitBetween.length;

      // Add payer
      balances[expense.paidBy._id] = (balances[expense.paidBy._id] || 0) + expense.amount;
      userMap[expense.paidBy._id] = expense.paidBy.name;

      // Subtract from each participant
      expense.splitBetween.forEach(user => {
        balances[user._id] = (balances[user._id] || 0) - splitAmount;
        userMap[user._id] = user.name;
      });
    });

    // Prepare summary
    const summary = Object.entries(balances).map(([userId, balance]) => ({
      userId,
      userName: userMap[userId],
      balance: Number(balance.toFixed(2)),
    }));

    // Simplify debts → minimal transactions
    const transactions = simplifyDebts(balances).map(t => ({
      from: { userId: t.from, userName: userMap[t.from] },
      to: { userId: t.to, userName: userMap[t.to] },
      amount: t.amount,
    }));

    res.json({ summary, transactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//
// ✏️ Update Expense
//
exports.updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { description, amount, paidBy, splitBetween } = req.body;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Only the payer can update
    if (expense.paidBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the payer can update this expense' });
    }

    // Validate group and members again
    const groupDoc = await Group.findById(expense.group).populate('members', '_id');
    if (!groupDoc) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Ensure all splitBetween are members
    if (splitBetween && splitBetween.length > 0) {
      const invalidUsers = splitBetween.filter(
        u => !groupDoc.members.some(m => m._id.toString() === u)
      );
      if (invalidUsers.length > 0) {
        return res.status(400).json({ message: 'Some users are not members of this group' });
      }
    }

    // Apply updates
    if (description) expense.description = description;
    if (amount) expense.amount = amount;
    if (paidBy) expense.paidBy = paidBy;
    if (splitBetween) expense.splitBetween = splitBetween;

    const updatedExpense = await expense.save();

    const populatedExpense = await updatedExpense
      .populate('paidBy', 'name email')
      .populate('splitBetween', 'name email');

    res.json(populatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//
// ❌ Delete Expense
//
exports.deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Only payer can delete
    if (expense.paidBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the payer can delete this expense' });
    }

    await expense.deleteOne();

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
