import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const charlie = accounts.get("wallet_3")!;
const dave = accounts.get("wallet_4")!;

describe("Signer Manager Contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("Initialization", () => {
    it("allows contract owner to initialize signers", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents duplicate signers during initialization", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(alice), Cl.principal(bob)]),
          Cl.uint(2),
        ],
        deployer
      );
      expect(result).toBeErr(Cl.uint(612)); // ERR_DUPLICATE_SIGNERS
    });

    it("validates threshold doesn't exceed signer count", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob)]),
          Cl.uint(3),
        ],
        deployer
      );
      expect(result).toBeErr(Cl.uint(611)); // ERR_THRESHOLD_EXCEEDS_SIGNERS
    });
  });

  describe("Add Signer Proposal", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "signer-manager",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("allows signer to propose adding new signer", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "propose-add-signer",
        [Cl.principal(dave)],
        alice
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("prevents non-signer from proposing", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "propose-add-signer",
        [Cl.principal(dave)],
        dave
      );
      expect(result).toBeErr(Cl.uint(601)); // ERR_NOT_A_SIGNER
    });

    it("prevents adding existing signer", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "propose-add-signer",
        [Cl.principal(alice)],
        bob
      );
      expect(result).toBeErr(Cl.uint(607)); // ERR_SIGNER_ALREADY_EXISTS
    });
  });

  describe("Remove Signer Proposal", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "signer-manager",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("allows signer to propose removing another signer", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "propose-remove-signer",
        [Cl.principal(charlie)],
        alice
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("prevents removing non-existent signer", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "propose-remove-signer",
        [Cl.principal(dave)],
        alice
      );
      expect(result).toBeErr(Cl.uint(608)); // ERR_SIGNER_DOES_NOT_EXIST
    });
  });

  describe("Threshold Update Proposal", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "signer-manager",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("allows updating threshold within valid range", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "propose-update-threshold",
        [Cl.uint(3)],
        alice
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("prevents threshold exceeding signer count", () => {
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "propose-update-threshold",
        [Cl.uint(4)],
        alice
      );
      expect(result).toBeErr(Cl.uint(611)); // ERR_THRESHOLD_EXCEEDS_SIGNERS
    });
  });

  describe("Voting and Execution", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "signer-manager",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("allows signers to vote on proposal", () => {
      // Create proposal
      simnet.callPublicFn(
        "signer-manager",
        "propose-add-signer",
        [Cl.principal(dave)],
        alice
      );

      // Vote
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "vote-proposal",
        [Cl.uint(0)],
        bob
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents duplicate voting", () => {
      // Create proposal
      simnet.callPublicFn(
        "signer-manager",
        "propose-add-signer",
        [Cl.principal(dave)],
        alice
      );

      // Try to vote again
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "vote-proposal",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeErr(Cl.uint(603)); // ERR_ALREADY_VOTED
    });

    it("executes proposal after threshold met", () => {
      // Create proposal
      simnet.callPublicFn(
        "signer-manager",
        "propose-add-signer",
        [Cl.principal(dave)],
        alice
      );

      // Vote (alice auto-voted, need 1 more)
      simnet.callPublicFn("signer-manager", "vote-proposal", [Cl.uint(0)], bob);

      // Execute
      const { result } = simnet.callPublicFn(
        "signer-manager",
        "execute-proposal",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify dave is now a signer
      const readResult = simnet.callReadOnlyFn(
        "signer-manager",
        "is-signer",
        [Cl.principal(dave)],
        alice
      );
      expect(readResult.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Read-only functions", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "signer-manager",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("returns current signers", () => {
      const { result } = simnet.callReadOnlyFn(
        "signer-manager",
        "get-signers",
        [],
        alice
      );
      expect(result).toBeOk(
        Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)])
      );
    });

    it("returns current threshold", () => {
      const { result } = simnet.callReadOnlyFn(
        "signer-manager",
        "get-threshold",
        [],
        alice
      );
      expect(result).toBeOk(Cl.uint(2));
    });

    it("checks if address is signer", () => {
      const aliceResult = simnet.callReadOnlyFn(
        "signer-manager",
        "is-signer",
        [Cl.principal(alice)],
        alice
      );
      expect(aliceResult.result).toBeOk(Cl.bool(true));

      const daveResult = simnet.callReadOnlyFn(
        "signer-manager",
        "is-signer",
        [Cl.principal(dave)],
        alice
      );
      expect(daveResult.result).toBeOk(Cl.bool(false));
    });
  });
});
