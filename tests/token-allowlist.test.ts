import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const charlie = accounts.get("wallet_3")!;

describe("Token Allowlist Contract", () => {
  const mockToken = `${deployer}.mock-token`;
  const otherToken = `${deployer}.other-token`;

  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("Initialization", () => {
    it("initializes with signers and threshold", () => {
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-owner from initializing", () => {
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "initialize",
        [Cl.list([Cl.principal(alice), Cl.principal(bob)]), Cl.uint(2)],
        alice
      );
      expect(result).toBeErr(Cl.uint(900)); // ERR_OWNER_ONLY
    });
  });

  describe("Direct Token Addition (Owner)", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "token-allowlist",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("allows owner to directly add token", () => {
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify token is allowed
      const isAllowed = simnet.callReadOnlyFn(
        "token-allowlist",
        "is-token-allowed",
        [Cl.principal(mockToken)],
        alice
      );
      expect(isAllowed.result).toBeOk(Cl.bool(true));
    });

    it("prevents adding duplicate token", () => {
      simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        deployer
      );

      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(903)); // ERR_TOKEN_ALREADY_ALLOWED
    });

    it("prevents non-owner from direct add", () => {
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        alice
      );
      expect(result).toBeErr(Cl.uint(900)); // ERR_OWNER_ONLY
    });
  });

  describe("Propose Add Token", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "token-allowlist",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("allows signer to propose adding token", () => {
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        alice
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("prevents non-signer from proposing", () => {
      const nonSigner = accounts.get("wallet_4")!;
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        nonSigner
      );
      expect(result).toBeErr(Cl.uint(901)); // ERR_NOT_A_SIGNER
    });

    it("prevents proposing to add already allowed token", () => {
      // Add token directly first
      simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        deployer
      );

      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        alice
      );
      expect(result).toBeErr(Cl.uint(903)); // ERR_TOKEN_ALREADY_ALLOWED
    });
  });

  describe("Propose Remove Token", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "token-allowlist",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
      simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        deployer
      );
    });

    it("allows signer to propose removing token", () => {
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "propose-remove-token",
        [Cl.principal(mockToken)],
        alice
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("prevents proposing to remove non-allowed token", () => {
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "propose-remove-token",
        [Cl.principal(otherToken)],
        alice
      );
      expect(result).toBeErr(Cl.uint(902)); // ERR_TOKEN_NOT_ALLOWED
    });
  });

  describe("Voting and Execution", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "token-allowlist",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("allows voting on proposal", () => {
      // Create proposal
      simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        alice
      );

      // Vote
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "vote-on-proposal",
        [Cl.uint(0)],
        bob
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents duplicate voting", () => {
      // Create proposal (alice auto-votes)
      simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        alice
      );

      // Try to vote again
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "vote-on-proposal",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeErr(Cl.uint(905)); // ERR_ALREADY_VOTED
    });

    it("executes add proposal after threshold", () => {
      // Create proposal
      simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        alice
      );

      // Get second vote
      simnet.callPublicFn("token-allowlist", "vote-on-proposal", [Cl.uint(0)], bob);

      // Execute
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "execute-proposal",
        [Cl.uint(0)],
        charlie
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify token is now allowed
      const isAllowed = simnet.callReadOnlyFn(
        "token-allowlist",
        "is-token-allowed",
        [Cl.principal(mockToken)],
        alice
      );
      expect(isAllowed.result).toBeOk(Cl.bool(true));
    });

    it("executes remove proposal after threshold", () => {
      // Add token first
      simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        deployer
      );

      // Create removal proposal
      simnet.callPublicFn(
        "token-allowlist",
        "propose-remove-token",
        [Cl.principal(mockToken)],
        alice
      );

      // Get second vote
      simnet.callPublicFn("token-allowlist", "vote-on-proposal", [Cl.uint(0)], bob);

      // Execute
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "execute-proposal",
        [Cl.uint(0)],
        charlie
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify token is no longer allowed
      const isAllowed = simnet.callReadOnlyFn(
        "token-allowlist",
        "is-token-allowed",
        [Cl.principal(mockToken)],
        alice
      );
      expect(isAllowed.result).toBeOk(Cl.bool(false));
    });

    it("prevents execution without threshold", () => {
      // Create proposal (only 1 vote)
      simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        alice
      );

      // Try to execute
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "execute-proposal",
        [Cl.uint(0)],
        bob
      );
      expect(result).toBeErr(Cl.uint(906)); // ERR_THRESHOLD_NOT_MET
    });

    it("prevents executing already executed proposal", () => {
      // Create and execute proposal
      simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        alice
      );
      simnet.callPublicFn("token-allowlist", "vote-on-proposal", [Cl.uint(0)], bob);
      simnet.callPublicFn("token-allowlist", "execute-proposal", [Cl.uint(0)], charlie);

      // Try to execute again
      const { result } = simnet.callPublicFn(
        "token-allowlist",
        "execute-proposal",
        [Cl.uint(0)],
        alice
      );
      expect(result).toBeErr(Cl.uint(907)); // ERR_ALREADY_EXECUTED
    });
  });

  describe("Read-only functions", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "token-allowlist",
        "initialize",
        [
          Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
          Cl.uint(2),
        ],
        deployer
      );
    });

    it("checks if token is allowed", () => {
      // Not allowed initially
      let result = simnet.callReadOnlyFn(
        "token-allowlist",
        "is-token-allowed",
        [Cl.principal(mockToken)],
        alice
      );
      expect(result.result).toBeOk(Cl.bool(false));

      // Add token
      simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        deployer
      );

      // Should be allowed now
      result = simnet.callReadOnlyFn(
        "token-allowlist",
        "is-token-allowed",
        [Cl.principal(mockToken)],
        alice
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("returns token info", () => {
      simnet.callPublicFn(
        "token-allowlist",
        "add-token-direct",
        [Cl.principal(mockToken)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "token-allowlist",
        "get-token-info",
        [Cl.principal(mockToken)],
        alice
      );
      expect(result).toBeOk(
        Cl.some(
          Cl.tuple({
            allowed: Cl.bool(true),
            "added-at": Cl.uint(simnet.blockHeight),
          })
        )
      );
    });

    it("returns proposal info", () => {
      simnet.callPublicFn(
        "token-allowlist",
        "propose-add-token",
        [Cl.principal(mockToken)],
        alice
      );

      const { result } = simnet.callReadOnlyFn(
        "token-allowlist",
        "get-proposal",
        [Cl.uint(0)],
        bob
      );
      expect(result).toBeOk(
        Cl.some(
          Cl.tuple({
            action: Cl.uint(1),
            token: Cl.principal(mockToken),
            votes: Cl.uint(1),
            executed: Cl.bool(false),
            "created-at": Cl.uint(simnet.blockHeight),
          })
        )
      );
    });
  });
});
