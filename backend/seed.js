/**
 * FOODIES.COM — Database Seeder
 * Run once: node backend/seed.js
 * Creates admin + all 12 menu items
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

const User     = require('./models/User');
const MenuItem = require('./models/MenuItem');

const menuItems = [
  {
    name: 'Steamed Momos',
    description: 'Soft dumplings filled with spiced veggies & meat, served with red chutney.',
    price: 210, originalPrice: 250,
    category: 'snacks', image: 'img/img/type1.jpg',
    badge: 'Popular', rating: 4.8, prepTime: '15 min', serves: 1, isFeatured: true, isAvailable: true
  },
  {
    name: 'Smash Burger',
    description: 'Double smash patty with cheddar, pickles, caramelized onion & secret sauce.',
    price: 299, originalPrice: 370,
    category: 'fastfood', image: 'img/img/type2.jpg',
    badge: 'New', rating: 4.9, prepTime: '20 min', serves: 1, isFeatured: true, isAvailable: true
  },
  {
    name: 'Wood-Fire Pizza',
    description: 'Crispy thin crust with mozzarella, fresh basil & San Marzano tomatoes.',
    price: 349, originalPrice: 440,
    category: 'fastfood', image: 'img/img/type3.jpg',
    badge: "Chef's Pick", rating: 4.7, prepTime: '25 min', serves: 2, isFeatured: true, isAvailable: true
  },
  {
    name: 'Special Veg Thali',
    description: 'Dal, sabzi, rice, 3 rotis, raita & dessert. A complete wholesome meal.',
    price: 229, originalPrice: 280,
    category: 'meals', image: 'img/img/type02.jpg',
    badge: 'Best Value', rating: 4.7, prepTime: '20 min', serves: 1, isAvailable: true
  },
  {
    name: 'Chicken Biryani',
    description: 'Slow-cooked dum biryani with tender chicken, saffron rice & raita.',
    price: 319, originalPrice: 399,
    category: 'meals', image: 'img/img/type03.jpg',
    badge: 'Non-Veg', rating: 4.9, prepTime: '30 min', serves: 1, isFeatured: true, isAvailable: true
  },
  {
    name: 'Crispy Snack Platter',
    description: 'Golden crispy bites served with 3 signature dipping sauces. Perfect for sharing.',
    price: 199, originalPrice: 249,
    category: 'snacks', image: 'img/img/type4.jpg',
    rating: 4.5, prepTime: '10 min', serves: 2, isAvailable: true
  },
  {
    name: 'Iced Peach Green Tea',
    description: 'Cold-brewed green tea with fresh peach, mint & a squeeze of lemon.',
    price: 139, originalPrice: 179,
    category: 'drinks', image: 'img/img/Iced Peach Green Tea [10 Minutes] - Chasety.jpg',
    badge: 'Healthy', rating: 4.6, prepTime: '5 min', serves: 1, isAvailable: true
  },
  {
    name: 'Fresh Fruit Juice',
    description: '100% cold-pressed seasonal fruits. No added sugar, no preservatives.',
    price: 159, originalPrice: 199,
    category: 'drinks', image: 'img/img/3569cd542d4880ccebd8400762d591c9juce.jpg',
    badge: 'Fresh', rating: 4.8, prepTime: '5 min', serves: 1, isAvailable: true
  },
  {
    name: 'Hakka Noodles',
    description: 'Wok-tossed noodles with fresh veggies, soy, chilli & sesame oil.',
    price: 249, originalPrice: 299,
    category: 'fastfood', image: 'img/img/img.jpg',
    badge: 'Trending', rating: 4.6, prepTime: '18 min', serves: 1, isAvailable: true
  },
  {
    name: 'Gulab Jamun (4 Pcs)',
    description: 'Melt-in-mouth khoya balls soaked in rose-flavoured sugar syrup. Served warm.',
    price: 99, originalPrice: 129,
    category: 'desserts', image: 'img/img/type1.jpg',
    badge: 'Sweet', rating: 4.9, prepTime: '5 min', serves: 1, isAvailable: true
  },
  {
    name: 'Choco Lava Brownie',
    description: 'Warm fudgy brownie with gooey chocolate lava centre, served with vanilla ice cream.',
    price: 179, originalPrice: 220,
    category: 'desserts', image: 'img/img/type2.jpg',
    badge: 'New', rating: 5.0, prepTime: '8 min', serves: 1, isAvailable: true
  },
  {
    name: 'Penne Arrabbiata',
    description: 'Al-dente penne in spicy tomato arrabbiata sauce, topped with fresh basil & parmesan.',
    price: 289, originalPrice: 349,
    category: 'meals', image: 'img/img/type3.jpg',
    badge: "Chef's Pick", rating: 4.8, prepTime: '22 min', serves: 1, isFeatured: true, isAvailable: true
  }
];

async function seed() {
  try {
    console.log('\n🌱 Starting database seed...\n');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await MenuItem.deleteMany({});
    await User.deleteMany({ email: 'admin@foodies.com' });
    console.log('🗑️  Cleared existing menu items and admin');

    // Insert all menu items
    const inserted = await MenuItem.insertMany(menuItems);
    console.log(`✅ Inserted ${inserted.length} menu items`);

    // Create admin user
    await User.create({
      name:     'Admin',
      email:    'admin@foodies.com',
      password: 'admin123',
      phone:    '+91 7007575886',
      role:     'admin'
    });
    console.log('✅ Admin user created');

    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║  🎉 Database seeded successfully!     ║');
    console.log('║                                       ║');
    console.log('║  Admin Login:                         ║');
    console.log('║  Email:    admin@foodies.com          ║');
    console.log('║  Password: admin123                   ║');
    console.log('║                                       ║');
    console.log('║  Now run: npm run dev                 ║');
    console.log('╚═══════════════════════════════════════╝\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.message.includes('MONGO_URI') || err.message.includes('connect')) {
      console.error('\n👉 Fix: Fill in MONGO_URI in backend/.env first\n');
    }
    process.exit(1);
  }
}

seed();
