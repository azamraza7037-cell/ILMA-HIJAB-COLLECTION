'use client';

import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { motion } from 'framer-motion';

export default function WhatsAppButton() {
  const whatsappUrl = "https://wa.me/919286558531?text=Assalamu%20Alaikum%20Ilma%20Hijab%20Collection%2C%0AI%20would%20like%20to%20know%20more%20about%20your%20products.";

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 1
        }}
        className="relative group"
      >
        {/* Tooltip */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 bg-white text-[#0a0a0a] text-sm font-medium py-2 px-4 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap hidden sm:block border border-[#E8DFD3]">
          Chat with us
          {/* Arrow */}
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 border-8 border-transparent border-l-white border-y-transparent border-r-transparent w-0 h-0"></div>
        </div>

        {/* Pulse effect */}
        <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-30"></div>
        
        {/* Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex items-center justify-center w-14 h-14 bg-[#25D366] text-white rounded-full shadow-lg hover:bg-[#128C7E] hover:scale-110 transition-all duration-300"
          aria-label="Chat with us on WhatsApp"
        >
          <FaWhatsapp size={28} />
        </a>
      </motion.div>
    </div>
  );
}
