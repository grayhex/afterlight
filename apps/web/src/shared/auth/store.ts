export type Role = 'guest' | 'owner' | 'verifier' | 'admin';

type Listener = () => void;

class AuthStore {
  private role: Role = 'guest';
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getRole() {
    return this.role;
  }

  private setRole(role: Role) {
    this.role = role;
    for (const listener of this.listeners) listener();
  }

  login(role: Role) {
    this.setRole(role);
  }

  logout() {
    this.setRole('guest');
  }
}

export const auth = new AuthStore();
