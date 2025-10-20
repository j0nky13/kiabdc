import { motion } from 'framer-motion';

export default function MotionWrapper({ children, x = 0, y = 20, delay = 0, duration = 0.6 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: false, amount: 0.5 }}
      transition={{ duration, delay }}
    >
      {children}
    </motion.div>
  );
}