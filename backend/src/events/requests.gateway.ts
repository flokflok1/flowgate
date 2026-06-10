import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RequestStatusChangedEvent } from '../requests/domain/events/request-status-changed.event';
import type { AuthUser } from '../shared/types/auth-user';
import { Role } from '../users/domain/value-objects/role';

// runs on the same http server; path sits under /api so the existing
// dev proxy and prod nginx location cover the websocket as well
@WebSocketGateway({ path: '/api/socket.io', cors: { origin: true } })
export class RequestsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const user = await this.jwt.verifyAsync<AuthUser>(token ?? '');
      // same visibility rules as REST: own room always, reviewers room for staff
      await client.join(`user:${user.sub}`);
      if (user.role !== Role.Requester) {
        await client.join('reviewers');
      }
    } catch {
      client.disconnect(true); // no valid token — no socket
    }
  }

  @OnEvent(RequestStatusChangedEvent.eventName)
  onStatusChanged(event: RequestStatusChangedEvent): void {
    this.server
      .to('reviewers')
      .to(`user:${event.requesterId}`)
      .emit('request.status-changed', event);
  }
}
