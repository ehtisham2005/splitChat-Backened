const Expense = require('../models/Expense');

// Add Expense
exports.addExpense = async (req, res) => {
  try {
    const { description, amount, paidBy, group, splitBetween } = req.body;
    const expense = await Expense.create({ description, amount, paidBy, group, splitBetween });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all expenses for a group
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy')
      .populate('splitBetween');
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.settleExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Fetch all expenses for the group
    const expenses = await Expense.find({ group: groupId })
      .populate('paidBy')
      .populate('splitBetween');

    if (!expenses.length) {
      return res.status(404).json({ message: 'No expenses found for this group' });
    }

    // Track balances for each user
    const balances = {};

    expenses.forEach(expense => {
      const splitAmount = expense.amount / expense.splitBetween.length;

      // Payer gets credited
      balances[expense.paidBy._id] = (balances[expense.paidBy._id] || 0) + expense.amount;

      // Each participant owes
      expense.splitBetween.forEach(user => {
        balances[user._id] = (balances[user._id] || 0) - splitAmount;
      });
    });

    // Prepare settlement summary
    const summary = Object.entries(balances).map(([userId, balance]) => ({
      userId,
      userName: expenses[0].splitBetween.find(u => u._id.toString() === userId)?.name 
                || expenses[0].paidBy.name,  // fallback
      balance: balance.toFixed(2)
    }));

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


//  Update Expense
exports.updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { description, amount, paidBy, splitBetween } = req.body;

    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      { description, amount, paidBy, splitBetween },
      { new: true }
    ).populate('paidBy').populate('splitBetween');

    if (!updatedExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(updatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Expense
exports.deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const deletedExpense = await Expense.findByIdAndDelete(expenseId);

    if (!deletedExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

