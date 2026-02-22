## Feature: Auto-Apply Commands Research

### Scenario: Intercept and Execute Agent Terminal Commands

- **GIVEN** the Antigravity agent proposes a terminal command
- **WHEN** the `antigravity.terminalCommand.run` or `antigravity.terminalCommand.accept` command is executed by our script
- **THEN** the proposed terminal command should be accepted and executed without requiring the user to click the UI button

### Scenario: Intercept and Execute File Modifications

- **GIVEN** the Antigravity agent proposes a code modification in a file
- **WHEN** the `antigravity.prioritized.agentAcceptAllInFile` or `antigravity.agent.acceptAgentStep` command is executed
- **THEN** the file changes should be applied automatically

### Scenario: Observe Agent Waiting State

- **GIVEN** the Antigravity agent is running a task
- **WHEN** it pauses to ask the user for confirmation (e.g. to run a command)
- **THEN** our system should detect this "waiting" state (via context keys, DOM observation, or polling mechanisms)

## BDD Requirements

### Requirement: Command Execution Validation

- The system MUST verify whether background execution of `antigravity.*` commands succeeds.
- The system MUST document the required arguments (if any) and the return values of these commands.

### Requirement: State Observation Validation

- The system MUST determine a reliable way to know when it is safe/necessary to send an "accept" command, avoiding sending them prematurely.
