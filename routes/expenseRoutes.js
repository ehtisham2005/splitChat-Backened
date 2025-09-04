const express = require("express");
const { body, param } = require("express-validator");
const expenseController = require("../controllers/expenseController");
const { protect } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validateRequest");

const router = express.Router();

// ➕ Add new expense
router.post(
  "/",
  protect,
  [
    body("description").notEmpty().withMessage("Description is required"),
    body("amount").isFloat({ gt: 0 }).withMessage("Amount must be greater than 0"),
    body("paidBy").notEmpty().withMessage("PaidBy (userId) is required"),
    body("group").notEmpty().withMessage("Group ID is required"),
    body("splitBetween")
      .isArray({ min: 1 })
      .withMessage("SplitBetween must be a non-empty array of user IDs"),
  ],
  validateRequest,
  expenseController.addExpense
);

// 📖 Get all expenses for a group
router.get(
  "/:groupId",
  protect,
  [param("groupId").notEmpty().withMessage("Group ID is required")],
  validateRequest,
  expenseController.getExpenses
);

// 📊 Get balances (no simplification)
router.get(
  "/balances/:groupId",
  protect,
  [param("groupId").notEmpty().withMessage("Group ID is required")],
  validateRequest,
  expenseController.getBalances
);

// ✅ Settlement with debt simplification
router.get(
  "/settlement/:groupId",
  protect,
  [param("groupId").notEmpty().withMessage("Group ID is required")],
  validateRequest,
  expenseController.settleExpenses
);

// ✏️ Update expense
router.put(
  "/:expenseId",
  protect,
  [
    param("expenseId").notEmpty().withMessage("Expense ID is required"),
    body("amount").optional().isFloat({ gt: 0 }).withMessage("Amount must be greater than 0"),
    body("description").optional().notEmpty().withMessage("Description cannot be empty"),
    body("splitBetween")
      .optional()
      .isArray()
      .withMessage("SplitBetween must be an array of user IDs"),
  ],
  validateRequest,
  expenseController.updateExpense
);

// ❌ Delete expense
router.delete(
  "/:expenseId",
  protect,
  [param("expenseId").notEmpty().withMessage("Expense ID is required")],
  validateRequest,
  expenseController.deleteExpense
);

module.exports = router;
