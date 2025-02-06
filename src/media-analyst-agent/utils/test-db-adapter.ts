export class TestDatabaseAdapter {
  private memories: Map<string, any> = new Map();
  private rooms: Map<string, any> = new Map();
  private accounts: Map<string, any> = new Map();
  private participants: Map<string, any[]> = new Map();

  async init(): Promise<void> {
    // Create default test account
    const testAccount = await this.createAccount({
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Test User',
      type: 'USER'
    });

    // Create default test room
    const testRoom = await this.createRoom({
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Test Room'
    });

    // Create default participant
    await this.createParticipant({
      accountId: testAccount.id,
      roomId: testRoom.id,
      role: 'USER'
    });
  }

  async createMemory(memory: any): Promise<any> {
    const id = Math.random().toString(36).substring(7);
    this.memories.set(id, { ...memory, id });
    return this.memories.get(id);
  }

  async getMemory(id: string): Promise<any> {
    return this.memories.get(id);
  }

  async updateMemory(id: string, memory: any): Promise<any> {
    this.memories.set(id, { ...memory, id });
    return this.memories.get(id);
  }

  async deleteMemory(id: string): Promise<void> {
    this.memories.delete(id);
  }

  async searchMemories(): Promise<any[]> {
    return Array.from(this.memories.values());
  }

  async createRoom(room: any): Promise<any> {
    const id = room.id || Math.random().toString(36).substring(7);
    this.rooms.set(id, { ...room, id });
    return this.rooms.get(id);
  }

  async getRoom(id: string): Promise<any> {
    return this.rooms.get(id) || null;
  }

  async updateRoom(id: string, room: any): Promise<any> {
    this.rooms.set(id, { ...room, id });
    return this.rooms.get(id);
  }

  async deleteRoom(id: string): Promise<void> {
    this.rooms.delete(id);
  }

  async searchRooms(): Promise<any[]> {
    return Array.from(this.rooms.values());
  }

  async createAccount(account: any): Promise<any> {
    const id = account.id || Math.random().toString(36).substring(7);
    this.accounts.set(id, { ...account, id });
    return this.accounts.get(id);
  }

  async getAccountById(id: string): Promise<any> {
    return this.accounts.get(id) || null;
  }

  async updateAccount(id: string, account: any): Promise<any> {
    this.accounts.set(id, { ...account, id });
    return this.accounts.get(id);
  }

  async deleteAccount(id: string): Promise<void> {
    this.accounts.delete(id);
  }

  async searchAccounts(): Promise<any[]> {
    return Array.from(this.accounts.values());
  }

  async createParticipant(participant: any): Promise<any> {
    const id = Math.random().toString(36).substring(7);
    const participantData = { ...participant, id };
    
    if (!this.participants.has(participant.accountId)) {
      this.participants.set(participant.accountId, []);
    }
    
    this.participants.get(participant.accountId)?.push(participantData);
    return participantData;
  }

  async addParticipant(accountId: string, roomId: string, role: string = 'USER'): Promise<any> {
    return this.createParticipant({
      accountId,
      roomId,
      role,
      createdAt: new Date().toISOString()
    });
  }

  async getParticipantsForAccount(accountId: string): Promise<any[]> {
    return this.participants.get(accountId) || [];
  }

  async getParticipantsForRoom(roomId: string): Promise<any[]> {
    const allParticipants = Array.from(this.participants.values()).flat();
    return allParticipants.filter(p => p.roomId === roomId);
  }

  async deleteParticipant(accountId: string, roomId: string): Promise<void> {
    const accountParticipants = this.participants.get(accountId) || [];
    const filtered = accountParticipants.filter(p => p.roomId !== roomId);
    this.participants.set(accountId, filtered);
  }
} 