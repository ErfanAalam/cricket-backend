import express from "express";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
import { User } from "../models/User.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import { Cashfree } from "cashfree-pg";

const router = express.Router();

const ID = process.env.TCASHFREE_ID;
const SECRET = process.env.TCASHFREE_SECRET;
const BACK = process.env.BACKEND_URL;
const FRONT = process.env.FRONTEND_URL;
Cashfree.XClientId = ID;
Cashfree.XClientSecret = SECRET;
Cashfree.XEnvironment = "SANDBOX";

// Helper to delete all transactions for a user
const deleteAllTransactions = async (mobile) => {
  await User.updateOne({ mobile }, { $set: { transactions: [] } });
  console.log("All recent transactions are deleted");
};

// Route: Create Order
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const user = await User.findOne({ _id: userId });
    // deleteAllTransactions(user.mobile)
    // return

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const orderId = `order_${Date.now()}`;
    const transactionId = `txn_${uuidv4()}`;

    user.transactions.push({
      TID: transactionId,
      OID: orderId,
      amount: amount,
      status: "PENDING",
    });

    await user.save();

    const orderRequest = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user._id,
        customer_name: user.name,
        customer_phone: user.mobile,
      },
      order_meta: {
        return_url: `${FRONT}/payment/orders/${orderId}`,
      },
    };

    const response = await fetch("https://sandbox.cashfree.com/pg/orders", {
      method: "POST",
      headers: {
        "x-api-version": "2025-01-01",
        "x-client-id": ID,
        "x-client-secret": SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderRequest),
    });

    const result = await response.json();

    if (result.order_status === "ACTIVE") {
      res.status(200).json({
        message: "Order created successfully",
        orderDetails: {
          orderId: result.order_id,
          orderAmount: result.order_amount,
          createdAt: result.created_at,
          paymentSessionId: result.payment_session_id,
        },
      });
    } else {
      res.status(400).json({
        error: "Failed to create order",
        details: result.message || "Unknown error occurred.",
      });
    }
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// Route: Check Order Status
router.get("/check-order/:order_id", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;
    const { order_id } = req.params;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const transaction = user.transactions.find((tx) => tx.OID === order_id);
    if (!transaction) {
      return res.status(404).json({ error: "No such transaction" });
    }

    const transactionTime = new Date(transaction.time).getTime();
    const now = Date.now();

    if (
      (transaction.status === "PENDING" &&
        now - transactionTime > 3 * 60 * 1000) ||
      transaction.status == "FAILED"
    ) {
      return res.status(200).json({
        status: "FAILED",
        reason:
          "Transaction was pending for over 3 minutes and has been marked as failed.",
        transaction,
      });
    }

    const response = await fetch(
      `https://sandbox.cashfree.com/pg/orders/${order_id}`,
      {
        method: "GET",
        headers: {
          "x-api-version": "2025-01-01",
          "x-client-id": ID,
          "x-client-secret": SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error("Failed to fetch order:", result);
      return res
        .status(400)
        .json({ error: result.message || "Unable to fetch order details." });
    }
    console.log(result);
    if (result.order_status == "PAID") {
      if (transaction.status == "PENDING") {
        user.amount = user.amount + transaction.amount;
        transaction.status = "SUCCESS";
        await user.save();
        return res.status(201).json({
          status: transaction.status,
          orderDetails: result,
          transaction,
        });
      } else {
        return res.status(200).json({
          status: transaction.status,
          orderDetails: result,
          transaction,
        });
      }
    }
  } catch (error) {
    console.error("Error checking order status:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
