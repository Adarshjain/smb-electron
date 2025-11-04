module.exports = {
  theme: {
    extend: {
      keyframes: {
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 1s steps(2, start) infinite',
      },
    },
  },
};
