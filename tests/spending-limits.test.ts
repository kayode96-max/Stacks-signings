import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const charlie = accounts.get("wallet_3")!;

describe("Spending Limits Contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("Initialization", () => {
    it("initializes with valid limits", () => {
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(1000000000), // 1000 STX daily
          Cl.uint(5000000000), // 5000 STX weekly
        ],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("rejects daily limit exceeding weekly limit", () => {
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob)]),
          Cl.uint(6000000000),
          Cl.uint(5000000000),
        ],
        deployer
      );
      expect(result).toBeErr(Cl.uint(804)); // ERR_INVALID_LIMIT
    });

    it("rejects zero limits", () => {
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "initialize",
        [Cl.list([Cl.principal(alice)]), Cl.uint(0), Cl.uint(1000000)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(804)); // ERR_INVALID_LIMIT
    });
  });

  describe("STX Transfer Limits", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "spending-limits",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(1000000000), // 1000 STX daily
          Cl.uint(3000000000), // 3000 STX weekly
        ],
        deployer
      );
    });

    it("allows transfer within daily limit", () => {
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(500000000)], // 500 STX
        alice
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents transfer exceeding daily limit", () => {
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(1500000000)], // 1500 STX
        alice
      );
      expect(result).toBeErr(Cl.uint(802)); // ERR_DAILY_LIMIT_EXCEEDED
    });

    it("tracks cumulative daily spending", () => {
      // First transfer
      simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(600000000)],
        alice
      );

      // Second transfer should exceed limit
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(600000000)],
        alice
      );
      expect(result).toBeErr(Cl.uint(802)); // ERR_DAILY_LIMIT_EXCEEDED
    });

    it("prevents transfer exceeding weekly limit", () => {
      // Multiple transfers within daily but exceeding weekly (5000 STX weekly limit)
      // Day 1: 900 STX
      simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(900000000)],
        alice
      );
      simnet.mineEmptyBlocks(150); // Next day

      // Day 2: 900 STX (total: 1800)
      simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(900000000)],
        alice
      );
      simnet.mineEmptyBlocks(150); // Another day

      // Day 3: 900 STX (total: 2700)
      simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(900000000)],
        alice
      );
      simnet.mineEmptyBlocks(150); // Another day

      // Day 4: 900 STX (total: 3600)
      simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(900000000)],
        alice
      );
      simnet.mineEmptyBlocks(150); // Another day

      // Day 5: 900 STX (total: 4500)
      simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(900000000)],
        alice
      );
      simnet.mineEmptyBlocks(150); // Another day

      // Day 6: 900 STX - This should exceed the 5000 STX weekly limit (total would be 5400)
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(900000000)],
        alice
      );
      expect(result).toBeErr(Cl.uint(803)); // ERR_WEEKLY_LIMIT_EXCEEDED
    });

    it("resets daily limit after 144 blocks", () => {
      // Use up daily limit
      simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(1000000000)],
        alice
      );

      // Mine blocks to next day
      simnet.mineEmptyBlocks(150);

      // Should allow new transfer
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(500000000)],
        alice
      );
      expect(result).toBeOk(Cl.bool(true));
    });
  });

  describe("Token Transfer Limits", () => {
    const mockToken = `${deployer}.mock-token`;

    beforeEach(() => {
      simnet.callPublicFn(
        "spending-limits",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(1000000000),
          Cl.uint(5000000000),
        ],
        deployer
      );

      // Configure token limits
      simnet.callPublicFn(
        "spending-limits",
        "configure-token-limits",
        [
          Cl.principal(mockToken),
          Cl.uint(10000), // Daily
          Cl.uint(50000), // Weekly
        ],
        alice
      );
    });

    it("allows token transfer within limits", () => {
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "check-token-transfer",
        [Cl.principal(mockToken), Cl.uint(5000)],
        alice
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents token transfer exceeding daily limit", () => {
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "check-token-transfer",
        [Cl.principal(mockToken), Cl.uint(15000)],
        alice
      );
      expect(result).toBeErr(Cl.uint(802)); // ERR_DAILY_LIMIT_EXCEEDED
    });

    it("rejects transfer for unconfigured token", () => {
      const otherToken = `${deployer}.other-token`;
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "check-token-transfer",
        [Cl.principal(otherToken), Cl.uint(100)],
        alice
      );
      expect(result).toBeErr(Cl.uint(806)); // ERR_TOKEN_NOT_CONFIGURED
    });
  });

  describe("Update Limits", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "spending-limits",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(1000000000),
          Cl.uint(5000000000),
        ],
        deployer
      );
    });

    it("allows signer to update STX limits", () => {
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "update-stx-limits",
        [Cl.uint(2000000000), Cl.uint(10000000000)],
        alice
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-signer from updating limits", () => {
      const nonSigner = accounts.get("wallet_4")!;
      const { result } = simnet.callPublicFn(
        "spending-limits",
        "update-stx-limits",
        [Cl.uint(2000000000), Cl.uint(10000000000)],
        nonSigner
      );
      expect(result).toBeErr(Cl.uint(801)); // ERR_NOT_A_SIGNER
    });
  });

  describe("Read-only functions", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "spending-limits",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob)]),
          Cl.uint(1000000000),
          Cl.uint(5000000000),
        ],
        deployer
      );
    });

    it("returns STX limits", () => {
      const { result } = simnet.callReadOnlyFn(
        "spending-limits",
        "get-stx-limits",
        [],
        alice
      );
      expect(result).toBeOk(
        Cl.tuple({
          "daily-limit": Cl.uint(1000000000),
          "weekly-limit": Cl.uint(5000000000),
        })
      );
    });

    it("returns STX spending info", () => {
      // Do some spending
      simnet.callPublicFn(
        "spending-limits",
        "check-stx-transfer",
        [Cl.uint(300000000)],
        alice
      );

      const { result } = simnet.callReadOnlyFn(
        "spending-limits",
        "get-stx-spent",
        [],
        alice
      );
      expect(result).toBeOk(
        Cl.tuple({
          "daily-spent": Cl.uint(300000000),
          "weekly-spent": Cl.uint(300000000),
          "daily-remaining": Cl.uint(700000000),
          "weekly-remaining": Cl.uint(4700000000),
        })
      );
    });

    it("checks if amount can be spent", () => {
      const canSpend = simnet.callReadOnlyFn(
        "spending-limits",
        "can-spend-stx",
        [Cl.uint(500000000)],
        alice
      );
      expect(canSpend.result).toBeOk(Cl.bool(true));

      const cannotSpend = simnet.callReadOnlyFn(
        "spending-limits",
        "can-spend-stx",
        [Cl.uint(2000000000)],
        alice
      );
      expect(cannotSpend.result).toBeOk(Cl.bool(false));
    });
  });
});
