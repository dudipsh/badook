import { makeAutoObservable, runInAction } from 'mobx';
import {
  usersService,
  type CreateUserPayload,
  type User,
  type UserRole,
} from '../services/users.service';

export class UsersStore {
  users: User[] = [];
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchUsers() {
    this.loading = true;
    try {
      const users = await usersService.listUsers();
      runInAction(() => {
        this.users = users;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async createUser(dto: CreateUserPayload) {
    const user = await usersService.createUser(dto);
    runInAction(() => {
      this.users = [...this.users, user];
    });
    return user;
  }

  async toggleActive(id: string, currentIsActive: boolean) {
    const updated = await usersService.updateUser(id, {
      isActive: !currentIsActive,
    });
    runInAction(() => {
      this.users = this.users.map((u) => (u.id === id ? updated : u));
    });
  }

  async changeRole(id: string, role: UserRole) {
    const updated = await usersService.updateUser(id, { role });
    runInAction(() => {
      this.users = this.users.map((u) => (u.id === id ? updated : u));
    });
  }
}
