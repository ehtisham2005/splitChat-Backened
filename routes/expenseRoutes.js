const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");

// Add new expense
router.post("/", expenseController.addExpense);

// Get all expenses for a group
router.get("/:groupId", expenseController.getExpenses);

// Update expense
router.put("/:expenseId", expenseController.updateExpense);

// Delete expense
router.delete("/:expenseId", expenseController.deleteExpense);

// Settlement calculation
router.get("/settle/:groupId", expenseController.settleExpenses);

module.exports = router;
