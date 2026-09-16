'use client';

import { motion, type Variants } from 'framer-motion';
import { 
  HiOutlineSparkles, 
  HiOutlineHeart, 
  HiOutlineShieldCheck, 
  HiOutlineCube, 
  HiOutlineChatBubbleLeftRight, 
  HiOutlineShoppingCart 
} from 'react-icons/hi2';

const features = [
  {
    icon: HiOutlineSparkles,
    title: 'Premium Quality',
    description: 'Every piece is crafted with the finest fabrics and attention to detail.'
  },
  {
    icon: HiOutlineHeart,
    title: 'Elegant Designs',
    description: 'Contemporary modest fashion that celebrates grace and sophistication.'
  },
  {
    icon: HiOutlineShieldCheck,
    title: 'Secure Payments',
    description: 'Shop with confidence using our trusted and secure payment methods.'
  },
  {
    icon: HiOutlineCube,
    title: 'Carefully Packed',
    description: 'Each order is lovingly packaged to ensure it arrives in perfect condition.'
  },
  {
    icon: HiOutlineChatBubbleLeftRight,
    title: 'Customer Support',
    description: 'Our dedicated team is here to assist you with any queries.'
  },
  {
    icon: HiOutlineShoppingCart,
    title: 'Easy Ordering',
    description: 'A seamless shopping experience from browsing to doorstep delivery.'
  }
];

export default function TrustSection() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <section className="py-24 bg-[#FAF7F2]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-serif text-gray-900"
          >
            Why Choose Ilma Hijab Collection?
          </motion.h2>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index} 
              variants={itemVariants}
              className="bg-white p-8 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 flex flex-col items-center text-center"
            >
              <div className="w-14 h-14 bg-[#FAF7F2] rounded-full flex items-center justify-center mb-6">
                <feature.icon className="w-7 h-7 text-[#C9A96E]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
