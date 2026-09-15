'use client';

import { motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import ErrorBoundary from '@/components/ui/ErrorBoundary';

const ParticleCanvas = dynamic(() => import('./ParticleCanvas'), {
  ssr: false,
});

export default function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
  };

  const headingText = "Modesty, Reimagined.";
  
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-black via-black to-[#0a0a0a]">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A96E' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      {/* 3D Particles */}
      <div className="absolute inset-0 z-0">
        <ErrorBoundary fallback={null}>
          <ParticleCanvas />
        </ErrorBoundary>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center space-y-8"
        >
          <motion.p 
            variants={itemVariants}
            className="text-[#C9A96E] text-xs sm:text-sm font-semibold tracking-[0.3em] uppercase"
          >
            ILMA HIJAB COLLECTION
          </motion.p>

          <motion.div 
            className="flex flex-wrap justify-center overflow-hidden"
            variants={itemVariants}
          >
            {headingText.split(' ').map((word, wordIndex) => (
              <span key={wordIndex} className="inline-block mr-[0.2em] whitespace-nowrap">
                {word.split('').map((char, charIndex) => (
                  <motion.span
                    key={`${wordIndex}-${charIndex}`}
                    className="inline-block text-5xl md:text-7xl lg:text-8xl font-serif text-white drop-shadow-lg"
                    variants={{
                      hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 40 },
                      visible: { 
                        opacity: 1, 
                        y: 0,
                        transition: { 
                          duration: 0.8, 
                          ease: [0.2, 0.65, 0.3, 0.9] 
                        } 
                      }
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </span>
            ))}
          </motion.div>

          <motion.p 
            variants={itemVariants}
            className="text-lg md:text-xl text-[#FAF7F2] max-w-2xl mx-auto font-sans font-light drop-shadow-md leading-relaxed"
          >
            Discover timeless Abayas, elegant Hijabs & graceful Naqabs crafted for the modern Muslim woman.
          </motion.p>

          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 w-full px-4"
          >
            <Link href="/#collection" passHref className="w-full sm:w-auto">
              <motion.button 
                whileHover={{ scale: shouldReduceMotion ? 1 : 1.05 }}
                whileTap={{ scale: shouldReduceMotion ? 1 : 0.95 }}
                className="w-full sm:w-auto bg-[#C9A96E] text-[#0a0a0a] px-10 py-4 font-semibold tracking-widest text-sm uppercase transition-colors hover:bg-[#b0925c]"
              >
                SHOP COLLECTION
              </motion.button>
            </Link>
            <Link href="/special-offers" passHref className="w-full sm:w-auto">
              <motion.button 
                whileHover={{ scale: shouldReduceMotion ? 1 : 1.05 }}
                whileTap={{ scale: shouldReduceMotion ? 1 : 0.95 }}
                className="w-full sm:w-auto bg-transparent border border-[#C9A96E] text-[#C9A96E] px-10 py-4 font-semibold tracking-widest text-sm uppercase transition-colors hover:bg-[#C9A96E]/10"
              >
                EXPLORE SPECIAL OFFERS
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-10"
      >
        <motion.div
          animate={{ y: shouldReduceMotion ? 0 : [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <ChevronDown className="text-[#C9A96E] w-8 h-8 opacity-70" />
        </motion.div>
      </motion.div>
    </section>
  );
}
