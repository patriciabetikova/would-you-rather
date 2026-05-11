import { FakeSocket } from "./socket";

export { FakeSocket } from "./socket";
export { fakeServer } from "./server";

export function createFakeSocket(): FakeSocket {
  return new FakeSocket();
}
