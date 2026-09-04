-- The anonymous MVP has no authenticated host role. Keeping a nickname in the
-- database could not prove ownership and previously enabled privilege spoofing.
ALTER TABLE "rooms" DROP COLUMN "hostNickname";
