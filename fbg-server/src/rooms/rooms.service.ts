import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Connection, MoreThan, QueryRunner } from 'typeorm';
import { RoomEntity } from './db/Room.entity';
import { RoomMembershipEntity } from './db/RoomMembership.entity';
import { UsersService } from '../users/users.service';
import shortid from 'shortid';
import { inTransaction } from '../util/TypeOrmUtil';
import { NewRoomInput } from './gql/NewRoomInput.gql';
import { PubSub } from 'graphql-subscriptions';
import { roomEntityToRoom } from './RoomUtil';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(RoomEntity)
    private roomRepository: Repository<RoomEntity>,
    private usersService: UsersService,
    private connection: Connection,
    private pubSub: PubSub,
  ) {}

  /** Creates a new room. */
  async newRoom(
    room: NewRoomInput,
    userId: number,
    queryRunner?: QueryRunner,
  ): Promise<RoomEntity> {
    const roomEntity = new RoomEntity();
    roomEntity.id = shortid.generate();
    roomEntity.capacity = room.capacity;
    roomEntity.gameCode = room.gameCode;
    roomEntity.isPublic = room.isPublic;
    if (!queryRunner) {
      await inTransaction(this.connection, async (queryRunner) => {
        await this.saveNewRoom(queryRunner, userId, roomEntity);
      });
    } else {
      await this.saveNewRoom(queryRunner, userId, roomEntity);
    }
    return roomEntity;
  }

  private async saveNewRoom(
    queryRunner: QueryRunner,
    userId: number,
    roomEntity: RoomEntity,
  ) {
    await queryRunner.manager.save(RoomEntity, roomEntity);
    await this.addMembership(queryRunner, userId, roomEntity, true);
  }

  /** Checks-in user and if room gets full starts the match. Returns match id, if any. */
  async joinRoom(userId: number, roomId: string): Promise<RoomEntity> {
    return await inTransaction(this.connection, async (queryRunner) => {
      const room = await this.getRoomEntity(roomId);
      if (room.match) {
        return room;
      }
      await this.addMembership(queryRunner, userId, room);
      return room;
    });
  }

  /** Gets a raw RoomEntity, with user information populated. */
  async getRoomEntity(roomId: string): Promise<RoomEntity> {
    const roomEntity = await this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.match', 'match')
      .leftJoinAndSelect('room.userMemberships', 'userMemberships')
      .leftJoinAndSelect('userMemberships.user', 'user')
      .where('room.id = :roomId', { roomId })
      .orderBy({
        'userMemberships.id': 'ASC',
      })
      .getOne();
    if (!roomEntity) {
      throw new HttpException(
        `Room id "${roomId}" does not exist`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return roomEntity;
  }

  async notifyRoomUpdate(room: RoomEntity) {
    await this.pubSub.publish(`room/${room.id}`, {
      roomMutated: roomEntityToRoom(room),
    });
  }

  private async addMembership(
    queryRunner: QueryRunner,
    userId: number,
    room: RoomEntity,
    isCreator: boolean = false,
  ) {
    const memberships = room.userMemberships || [];
    if (memberships.find((m) => m.user.id === userId)) {
      return;
    }
    if (memberships.length >= room.capacity) {
      return;
    }
    const membership = new RoomMembershipEntity();
    membership.user = await this.usersService.getUserEntity(userId);
    membership.room = room;
    membership.lastSeen = Date.now();
    membership.isCreator = isCreator;
    await queryRunner.manager.save(membership);
    room.userMemberships = [...memberships, membership];
    await this.notifyRoomUpdate(room);
  }
}
