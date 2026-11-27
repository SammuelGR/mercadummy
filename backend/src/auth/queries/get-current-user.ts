import { Query, QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import type { AuthUserResponse } from '../auth.dto.js';
import type { Session } from '../session.js';

/** Returns the user stored in the session, which `SessionGuard` has already read from Redis. */
export class GetCurrentUserQuery extends Query<AuthUserResponse> {
  constructor(readonly session: Session) {
    super();
  }
}

@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler implements IQueryHandler<GetCurrentUserQuery> {
  execute(query: GetCurrentUserQuery): Promise<AuthUserResponse> {
    const { userId, fullName, role } = query.session;
    return Promise.resolve({ id: userId, fullName, role });
  }
}
