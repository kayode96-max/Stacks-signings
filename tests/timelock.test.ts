import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const charlie = accounts.get("wallet_3")!;

describe("Timelock Contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("Initialization", () => {
    it("initializes with valid delay period", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
          Cl.uint(144), // 1 day
        ],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("rejects delay below minimum", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob)]),
          Cl.uint(2),
          Cl.uint(100), // Too short
        ],
        deployer
      );
      expect(result).toBeErr(Cl.uint(709)); // ERR_INVALID_DELAY
    });

    it("rejects delay above maximum", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob)]),
          Cl.uint(2),
          Cl.uint(5000), // Too long
        ],
        deployer
      );
      expect(result).toBeErr(Cl.uint(709)); // ERR_INVALID_DELAY
    });
  });

  describe("Queue Transaction", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "timelock",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
          Cl.uint(144),
        ],
        deployer
      );
    });

    it("allows signer to queue STX transfer", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [
          Cl.uint(0), // STX type
          Cl.uint(1000000),
          Cl.principal(deployer),
          Cl.none(),
        ],
        alice
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("allows signer to queue token transfer", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [
          Cl.uint(1), // SIP-010 type
          Cl.uint(1000),
          Cl.principal(deployer),
          Cl.some(Cl.principal(`${deployer}.mock-token`)),
        ],
        alice
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("prevents non-signer from queuing", () => {
      const nonSigner = accounts.get("wallet_4")!;
      const { result } = simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [Cl.uint(0), Cl.uint(1000000), Cl.principal(deployer), Cl.none()],
        nonSigner
      );
      expect(result).toBeErr(Cl.uint(701)); // ERR_NOT_A_SIGNER
    });

    it("prevents queuing with zero amount", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [Cl.uint(0), Cl.uint(0), Cl.principal(deployer), Cl.none()],
        alice
      );
      expect(result).toBeErr(Cl.uint(712)); // ERR_INVALID_AMOUNT
    });
  });

  describe("Approve Transaction", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "timelock",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
          Cl.uint(144),
        ],
        deployer
      );
      simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [Cl.uint(0), Cl.uint(1000000), Cl.principal(deployer), Cl.none()],
        alice
      );
    });

    it("allows second signer to approve", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "approve-transaction",
        [Cl.uint(0)],
        bob
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents duplicate approval", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "approve-transaction",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeErr(Cl.uint(703)); // ERR_ALREADY_QUEUED (reused for duplicate)
    });
  });

  describe("Execute STX Transfer", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "timelock",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
          Cl.uint(144),
        ],
        deployer
      );
    });

    it("prevents execution before timelock expires", () => {
      simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [Cl.uint(0), Cl.uint(1000000), Cl.principal(deployer), Cl.none()],
        alice
      );
      simnet.callPublicFn("timelock", "approve-transaction", [Cl.uint(0)], bob);

      const { result } = simnet.callPublicFn(
        "timelock",
        "execute-stx-transfer",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeErr(Cl.uint(705)); // ERR_TIMELOCK_NOT_MET
    });

    it("allows execution after timelock and threshold met", () => {
      // Fund the contract first
      simnet.transferSTX(10000000, `${deployer}.timelock`, deployer);

      simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [Cl.uint(0), Cl.uint(1000000), Cl.principal(deployer), Cl.none()],
        alice
      );
      simnet.callPublicFn("timelock", "approve-transaction", [Cl.uint(0)], bob);

      // Mine blocks to pass the delay
      simnet.mineEmptyBlocks(150);

      const { result } = simnet.callPublicFn(
        "timelock",
        "execute-stx-transfer",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents execution without threshold approvals", () => {
      simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [Cl.uint(0), Cl.uint(1000000), Cl.principal(deployer), Cl.none()],
        alice
      );

      simnet.mineEmptyBlocks(150);

      const { result } = simnet.callPublicFn(
        "timelock",
        "execute-stx-transfer",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeErr(Cl.uint(710)); // ERR_THRESHOLD_NOT_MET
    });
  });

  describe("Cancel Transaction", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "timelock",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
          Cl.uint(144),
        ],
        deployer
      );
      simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [Cl.uint(0), Cl.uint(1000000), Cl.principal(deployer), Cl.none()],
        alice
      );
    });

    it("allows signer to cancel queued transaction", () => {
      const { result } = simnet.callPublicFn(
        "timelock",
        "cancel-transaction",
        [Cl.uint(0)],
        bob
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents executing cancelled transaction", () => {
      simnet.callPublicFn("timelock", "cancel-transaction", [Cl.uint(0)], bob);
      simnet.mineEmptyBlocks(150);

      const { result } = simnet.callPublicFn(
        "timelock",
        "execute-stx-transfer",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeErr(Cl.uint(708)); // ERR_ALREADY_CANCELLED
    });
  });

  describe("Read-only functions", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "timelock",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
          Cl.uint(144),
        ],
        deployer
      );
    });

    it("returns current delay", () => {
      const { result } = simnet.callReadOnlyFn("timelock", "get-delay", [], alice);
      expect(result).toBeOk(Cl.uint(144));
    });

    it("checks if transaction can execute", () => {
      simnet.callPublicFn(
        "timelock",
        "queue-transaction",
        [Cl.uint(0), Cl.uint(1000000), Cl.principal(deployer), Cl.none()],
        alice
      );
      simnet.callPublicFn("timelock", "approve-transaction", [Cl.uint(0)], bob);

      // Before delay
      let canExecute = simnet.callReadOnlyFn(
        "timelock",
        "can-execute",
        [Cl.uint(0)],
        alice
      );
      expect(canExecute.result).toBeOk(Cl.bool(false));

      // After delay
      simnet.mineEmptyBlocks(150);
      canExecute = simnet.callReadOnlyFn("timelock", "can-execute", [Cl.uint(0)], alice);
      expect(canExecute.result).toBeOk(Cl.bool(true));
    });
  });
});
