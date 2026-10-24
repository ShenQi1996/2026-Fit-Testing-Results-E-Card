const listeners = new Set();

/** Sidebar recounts when a fit test is saved or the retention purge finishes. */
export const subscribeFitTestActivity = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notifyFitTestActivity = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('Fit test activity listener failed:', error);
    }
  });
};
