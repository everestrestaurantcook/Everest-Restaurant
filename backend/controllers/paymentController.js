import asyncHandler from '../utils/asyncHandler.js';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import Reservation from '../models/Reservation.js';
import AdminNotification from '../models/AdminNotification.js';
import PaymentNotificationService from '../utils/paymentNotification.js';
import paymeService from '../utils/payme.js';
import { emitToAll } from '../utils/socketEmitter.js';

// Create payment for order
export const createOrderPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  
  if (!orderId) {
    res.status(400);
    throw new Error('Order ID is required');
  }

  const order = await Order.findById(orderId).populate('user');
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.user._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to pay for this order');
  }

  if (order.isPaid) {
    res.status(400);
    throw new Error('Order is already paid');
  }

  try {
    const paymentData = paymeService.createOrderPayment(order);
    
    // Create payment record with metadata
    const payment = new Payment({
      user: req.user._id,
      order: orderId,
      amount: paymentData.amount,
      currency: 'UZS',
      paymentMethod: 'Payme',
      status: 'Pending',
      paymentUrl: paymentData.paymentUrl,
      orderId: paymentData.orderId,
      description: paymentData.description,
      
      // Payme data
      paymeData: {
        merchantId: paymeService.merchantId,
        account: paymentData.orderId,
        amount: Math.round(paymentData.amount * 100), // in tiyin
        signature: paymentData.signature,
        callbackUrl: `${process.env.FRONTEND_URL}/api/payments/webhook/payme`,
        returnUrl: `${process.env.FRONTEND_URL}/payment/success?orderId=${paymentData.orderId}`,
        failureUrl: `${process.env.FRONTEND_URL}/payment/failure?orderId=${paymentData.orderId}`
      },
      
      // Metadata
      metadata: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        deviceInfo: req.get('User-Agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
        location: req.get('CF-IPCountry') || 'Unknown',
        timezone: req.get('X-Timezone') || 'Asia/Tashkent'
      },
      
      statusHistory: [{
        status: 'Pending',
        changedAt: new Date(),
        reason: 'Payment created',
        note: 'Payment link generated'
      }]
    });

    await payment.save();

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        paymentUrl: paymentData.paymentUrl,
        amount: paymentData.amount,
        orderId: paymentData.orderId
      }
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500);
    throw new Error('Failed to create payment');
  }
});

// Create payment for reservation
export const createReservationPayment = asyncHandler(async (req, res) => {
  // console.log('🔍 createReservationPayment called with body:', req.body);
  // console.log('👤 User:', req.user);
  // console.log('🔍 Request headers:', req.headers);
  
  const { reservationId } = req.body;
  
  if (!reservationId) {
    console.error('❌ Reservation ID is missing');
    res.status(400);
    throw new Error('Reservation ID is required');
  }

  // console.log('🔍 Looking for reservation with ID:', reservationId);
  
  try {
    const reservation = await Reservation.findById(reservationId);
    // console.log('🔍 Reservation query result:', reservation);
    
    if (!reservation) {
      console.error('❌ Reservation not found with ID:', reservationId);
      res.status(404);
      throw new Error('Reservation not found');
    }

    // console.log('✅ Reservation found:', {
    //   _id: reservation._id,
    //   name: reservation.name,
    //   totalPrice: reservation.totalPrice,
    //   pricePerGuest: reservation.pricePerGuest,
    //   guests: reservation.guests,
    //   user: reservation.user
    // });

    if (reservation.user && reservation.user.toString() !== req.user._id.toString()) {
      console.error('❌ User not authorized for this reservation');
      res.status(403);
      throw new Error('Not authorized to pay for this reservation');
    }

    if (reservation.isPaid) {
      console.error('❌ Reservation is already paid');
      res.status(400);
      throw new Error('Reservation is already paid');
    }

    // console.log('🔍 Creating payment data with paymeService...');
    const paymentData = paymeService.createReservationPayment(reservation);
    // console.log('✅ Payment data created:', paymentData);
    
    // Create payment record with metadata
    const payment = new Payment({
      user: req.user._id,
      reservation: reservationId,
      amount: paymentData.amount,
      currency: 'UZS',
      paymentMethod: 'Payme',
      status: 'Pending',
      paymentUrl: paymentData.paymentUrl,
      orderId: paymentData.orderId,
      description: paymentData.description,
      
      // Payme data
      paymeData: {
        merchantId: paymeService.merchantId,
        account: paymentData.orderId,
        amount: Math.round(paymentData.amount * 100), // in tiyin
        signature: paymentData.signature,
        callbackUrl: `${process.env.FRONTEND_URL}/api/payments/webhook/payme`,
        returnUrl: `${process.env.FRONTEND_URL}/payment/success?orderId=${paymentData.orderId}`,
        failureUrl: `${process.env.FRONTEND_URL}/payment/failure?orderId=${paymentData.orderId}`
      },
      
      // Metadata
      metadata: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        deviceInfo: req.get('User-Agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
        location: req.get('CF-IPCountry') || 'Unknown',
        timezone: req.get('X-Timezone') || 'Asia/Tashkent'
      },
      
      statusHistory: [{
        status: 'Pending',
        changedAt: new Date(),
        reason: 'Payment created',
        note: 'Payment link generated'
      }]
    });

    // console.log('💾 Saving payment to database...');
    await payment.save();
    // console.log('✅ Payment saved successfully');

    const response = {
      success: true,
      data: {
        paymentId: payment._id,
        paymentUrl: paymentData.paymentUrl,
        amount: paymentData.amount,
        orderId: paymentData.orderId
      }
    };
    
    // console.log('📤 Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Payment creation error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500);
    throw new Error('Failed to create payment');
  }
});

// Payme webhook handler
export const handlePaymeWebhook = asyncHandler(async (req, res) => {
  try {
    const callbackData = req.body;
    
    // console.log('Payme webhook received:', callbackData);
    
    // Verify the webhook
    const result = paymeService.handlePaymentCallback(callbackData);
    
    if (!result.success) {
      res.status(400).json({ error: 'Payment failed' });
      return;
    }

    const { orderId, amount, transactionId } = result;
    
    // Find and update payment record
    const payment = await Payment.findOne({ orderId });
    
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    // Extract card information from Payme callback
    const cardInfo = {
      cardNumber: callbackData.card?.number?.slice(-4) || null,
      cardType: callbackData.card?.type || null,
      cardBrand: callbackData.card?.brand || null,
      maskedNumber: callbackData.card?.masked_number || null
    };

    // Update payment with all Payme data
    payment.status = 'Completed';
    payment.transactionId = transactionId;
    payment.completedAt = new Date();
    
    // Update transaction details
    payment.transactionDetails = {
      paycomId: callbackData.paycom_id || transactionId,
      paycomTime: callbackData.paycom_time ? new Date(callbackData.paycom_time * 1000) : new Date(),
      createTime: callbackData.create_time ? new Date(callbackData.create_time * 1000) : new Date(),
      performTime: callbackData.perform_time ? new Date(callbackData.perform_time * 1000) : new Date(),
      cancelTime: callbackData.cancel_time ? new Date(callbackData.cancel_time * 1000) : null,
      cancelReason: callbackData.cancel_reason || null,
      receivers: callbackData.receivers || []
    };
    
    // Update card information
    if (cardInfo.cardNumber) {
      payment.cardInfo = cardInfo;
    }
    
    // Add status history
    payment.statusHistory.push({
      status: 'Completed',
      changedAt: new Date(),
      reason: 'Payment successful',
      note: `Payment completed via Payme. Transaction ID: ${transactionId}`
    });

    await payment.save();

    // Update order or reservation
    if (payment.order) {
      const order = await Order.findById(payment.order);
      if (order) {
        order.isPaid = true;
        order.paidAt = new Date();
        order.paymentResult = {
          id: transactionId,
          status: 'COMPLETED',
          update_time: new Date().toISOString(),
          email_address: order.shippingAddress.email
        };
        await order.save();
      }
    }

    if (payment.reservation) {
      const reservation = await Reservation.findById(payment.reservation);
      if (reservation) {
        reservation.isPaid = true;
        reservation.paidAt = new Date();
        await reservation.save();
      }
    }

    // Create admin notification with detailed payment info
    await createDetailedPaymentNotification(payment);

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get payment status
export const getPaymentStatus = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  
  const payment = await Payment.findById(paymentId);
  
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  if (payment.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to view this payment');
  }

  res.json({
    success: true,
    data: {
      status: payment.status,
      amount: payment.amount,
      paymentUrl: payment.paymentUrl,
      completedAt: payment.completedAt,
      cardInfo: payment.cardInfo,
      transactionDetails: payment.transactionDetails
    }
  });
});

// Get user payments
export const getUserPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 },
    populate: ['order', 'reservation']
  };

  const payments = await Payment.paginate({ user: req.user._id }, options);
  
  res.json({
    success: true,
    data: payments
  });
});

// Get all payments (admin)
export const getAllPayments = asyncHandler(async (req, res) => {
  // console.log('🔍 getAllPayments called with query:', req.query);
  
  const { page = 1, limit = 20, status, paymentMethod, type } = req.query;
  
  const query = {};
  if (status && status !== 'all') query.status = status;
  if (paymentMethod && paymentMethod !== 'all') query.paymentMethod = paymentMethod;
  if (type && type !== 'all') query.type = type;

  // console.log('🔍 Query filter:', query);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 },
    populate: ['user', 'order', 'reservation']
  };

  // console.log('🔍 Pagination options:', options);

  const payments = await Payment.paginate(query, options);
  
  // console.log('🔍 Payments found:', payments.docs?.length || 0);
  // console.log('🔍 Total payments:', payments.totalDocs || 0);
  // console.log('🔍 Payment statuses:', [...new Set(payments.docs?.map(p => p.status) || [])]);
  
  res.json({
    success: true,
    data: payments
  });
});

// Get payment statistics (admin)
export const getPaymentStats = asyncHandler(async (req, res) => {
  const stats = await PaymentNotificationService.getPaymentStats();
  res.json({
    success: true,
    data: stats
  });
});

// Get recent payments (admin)
export const getRecentPayments = asyncHandler(async (req, res) => {
  try {
    const recent = await PaymentNotificationService.getAdminNotifications(10, 1);
    res.json({
      success: true,
      data: recent.payments || []
    });
  } catch (error) {
    console.error('Error fetching recent payments:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// Create detailed payment notification
export const createDetailedPaymentNotification = asyncHandler(async (payment) => {
  try {
    // Get all admin users
    const User = (await import('../models/User.js')).default;
    const adminUsers = await User.find({ isAdmin: true });
    
    // Create notifications for all admins with detailed payment info
    for (const admin of adminUsers) {
      await AdminNotification.createDetailedPaymentNotification(payment, admin._id);
    }

    // Emit socket event for real-time notification
    emitToAll('payment_received', {
      paymentId: payment._id,
      amount: payment.amount,
      userId: payment.user,
      cardInfo: payment.cardInfo,
      transactionId: payment.transactionId,
      timestamp: new Date()
    });
  } catch (notificationError) {
    console.error('Failed to create detailed payment notification:', notificationError);
  }
});

// Create payment received notification (legacy)
export const createPaymentNotification = asyncHandler(async (paymentId, amount, userId) => {
  try {
    // Get all admin users
    const User = (await import('../models/User.js')).default;
    const adminUsers = await User.find({ isAdmin: true });
    
    // Create notifications for all admins
    for (const admin of adminUsers) {
      await AdminNotification.createPaymentReceivedNotification(paymentId, amount, admin._id);
    }

    // Emit socket event for real-time notification
    emitToAll('payment_received', {
      paymentId,
      amount,
      userId,
      timestamp: new Date()
    });
  } catch (notificationError) {
    console.error('Failed to create payment notification:', notificationError);
  }
}); 