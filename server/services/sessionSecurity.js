import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '2h';
export const IMPERSONATION_TOKEN_EXPIRES_IN = '15m';
export const ADMIN_STEP_UP_EXPIRES_IN = '5m';
const ISSUER = 'serviciosatuhogar';
const AUDIENCE = 'serviciosatuhogar-web';

const getJwtSecret = (provided) => {
    const secret = provided || process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required.');
    return secret;
};

const normalizeTokenVersion = (user) => {
    const value = Number(user?.token_version ?? user?.tokenVersion);
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('A valid token version is required.');
    }
    return value;
};

export const createAccessToken = (user, {
    secret,
    expiresIn = ACCESS_TOKEN_EXPIRES_IN,
    impersonatedBy
} = {}) => {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: normalizeTokenVersion(user),
        tokenType: 'access'
    };
    if (impersonatedBy) payload.impersonatedBy = impersonatedBy;

    return jwt.sign(payload, getJwtSecret(secret), {
        expiresIn,
        issuer: ISSUER,
        audience: AUDIENCE,
        subject: String(user.id)
    });
};

export const verifyAccessToken = (token, { secret } = {}) => {
    const claims = jwt.verify(token, getJwtSecret(secret), {
        issuer: ISSUER,
        audience: AUDIENCE
    });
    if (!claims || claims.tokenType !== 'access' || claims.sub !== String(claims.id)) {
        throw new Error('Invalid access token type.');
    }
    return claims;
};

export const createAdminStepUpToken = (admin, { secret } = {}) => (
    jwt.sign({
        id: admin.id,
        role: admin.role,
        tokenVersion: normalizeTokenVersion(admin),
        purpose: 'admin_step_up'
    }, getJwtSecret(secret), {
        expiresIn: ADMIN_STEP_UP_EXPIRES_IN,
        issuer: ISSUER,
        audience: AUDIENCE,
        subject: String(admin.id),
        jwtid: crypto.randomUUID()
    })
);

export const verifyAdminStepUpToken = (token, { secret } = {}) => {
    const claims = jwt.verify(token, getJwtSecret(secret), {
        issuer: ISSUER,
        audience: AUDIENCE
    });
    if (!claims || claims.purpose !== 'admin_step_up' || claims.role !== 'admin' || claims.sub !== String(claims.id)) {
        throw new Error('Invalid admin step-up token.');
    }
    return claims;
};

export const hasCurrentTokenVersion = (claims, user) => {
    const claimVersion = Number(claims?.tokenVersion);
    const currentVersion = Number(user?.token_version ?? user?.tokenVersion);
    return Number.isSafeInteger(claimVersion)
        && Number.isSafeInteger(currentVersion)
        && claimVersion >= 0
        && claimVersion === currentVersion;
};

export const hashSecurityToken = (token) => (
    crypto.createHash('sha256').update(String(token), 'utf8').digest('hex')
);
