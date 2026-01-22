/**
 * Simple PubSub Store for Loe.me Widget
 * Manages global application state.
 */
class Store {
  constructor() {
    this.state = {
      isOpen: false,
      currentView: 'intention', // Default view is now intention
      currentIntention: '',
      user: {
        xp: 100,
        streak: 7,
        name: 'Guest'
      },
      missions: [
        { id: 1, status: 'done', x: 50, y: 10 },
        // ... (rest of missions can stay for now, used in progression view)
      ]
    };

    this.listeners = new Set();
  }

  // ... (subscribe/notify methods remain the same) 
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  // --- Actions ---

  toggleWidget() {
    this.setState({ isOpen: !this.state.isOpen });
  }

  setOpen(isOpen) {
    this.setState({ isOpen });
  }

  navigateTo(view) {
    this.setState({ currentView: view });
  }

  startRitual(intention) {
    this.state.currentIntention = intention;
    this.state.currentView = 'ritual';
    this.notify();
  }

  completeMission(id) {
    // Logic to unlock next mission would go here
    this.setState({
      user: { ...this.state.user, xp: this.state.user.xp + 20 }
    });
  }
}

export const store = new Store();
