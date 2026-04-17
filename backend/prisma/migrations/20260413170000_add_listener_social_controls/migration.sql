ALTER TABLE "ListenerProfile"
ADD COLUMN "welcomeMessage" TEXT;

CREATE TABLE "ListenerFavourite" (
    "id" TEXT NOT NULL,
    "listenerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListenerFavourite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListenerBlockedUser" (
    "id" TEXT NOT NULL,
    "listenerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListenerBlockedUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListenerFavourite_listenerId_userId_key" ON "ListenerFavourite"("listenerId", "userId");
CREATE INDEX "ListenerFavourite_listenerId_createdAt_idx" ON "ListenerFavourite"("listenerId", "createdAt");
CREATE INDEX "ListenerFavourite_userId_createdAt_idx" ON "ListenerFavourite"("userId", "createdAt");

CREATE UNIQUE INDEX "ListenerBlockedUser_listenerId_userId_key" ON "ListenerBlockedUser"("listenerId", "userId");
CREATE INDEX "ListenerBlockedUser_listenerId_createdAt_idx" ON "ListenerBlockedUser"("listenerId", "createdAt");
CREATE INDEX "ListenerBlockedUser_userId_createdAt_idx" ON "ListenerBlockedUser"("userId", "createdAt");

ALTER TABLE "ListenerFavourite"
ADD CONSTRAINT "ListenerFavourite_listenerId_fkey"
FOREIGN KEY ("listenerId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ListenerFavourite"
ADD CONSTRAINT "ListenerFavourite_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ListenerBlockedUser"
ADD CONSTRAINT "ListenerBlockedUser_listenerId_fkey"
FOREIGN KEY ("listenerId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ListenerBlockedUser"
ADD CONSTRAINT "ListenerBlockedUser_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
