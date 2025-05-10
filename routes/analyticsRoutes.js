import express from 'express';
import { MatchSchedule } from '../models/MatchSchedule.js';
import axios from 'axios';
import cron from 'node-cron';
import dotenv from 'dotenv';

const router = express.Router();

router.get('/total-users', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    res.status(200).json({
      message: 'Total registered users count retrieved',
      count: totalUsers
    });
  } catch (error) {
    console.error('Error counting registered Users:', error);
    res.status(500).json({
      message: 'Failed to count registered users',
      error: error.message
    });
  }
});

router.get('/total-active-users', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    res.status(200).json({
      message: 'Total registered users count retrieved',
      count: totalUsers
    });
  } catch (error) {
    console.error('Error counting registered Users:', error);
    res.status(500).json({
      message: 'Failed to count registered users',
      error: error.message
    });
  }

})
