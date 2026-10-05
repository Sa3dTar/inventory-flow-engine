const User = require('../database/user'); // تأكد من مسار الـ Model حسب هيكل مشروعك
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// مفتاح التوقيع الخاص بالـ JWT (يفضل وضعه في ملف .env)
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_here';
const JWT_EXPIRES_IN = '1d'; // صلاحية الـ Token

// 1. تسجيل مستخدم جديد (Register)
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // التحقق من وجود المستخدم مسبقاً
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already in use'
      });
    }

    // تشفير كلمة المرور (Hashing)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // إنشاء المستخدم الجديد
    const newUser = new User({
      name,
      email,
      passwordHash,
      role: role || 'WAREHOUSE_KEEPER'
    });

    await newUser.save();

    // إخفاء الـ passwordHash قبل إرجاع الاستجابة
    const userResponse = newUser.toObject();
    delete userResponse.passwordHash;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: userResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 2. تسجيل الدخول (Login)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // التحقق من الحقول الأساسية
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // البحث عن المستخدم بالبريد الإلكتروني
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // التحقق مما إذا كان الحساب مفعل
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Contact admin.'
      });
    }

    // مطابقة كلمة المرور
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // إنشاء JWT Token يحتوي على بيانات المستخدم (Id & Role)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      data: userResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. تسجيل الخروج (Logout)
exports.logout = async (req, res) => {
  try {
    // في حالة استخدام JWT البسيط (Stateless)، تسجيل الخروج غالباً بيتم من جهة الـ Frontend
    // بحذف الـ Token من الـ LocalStorage أو Cookies.
    // لكن بنرجع استجابة ناجحة عشان نأكد انتهاء الجلسة.
    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Please clear your token on client side.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};