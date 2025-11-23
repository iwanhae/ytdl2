package command

import (
	"bufio"
	"io"
	"os/exec"
	"sync"
	"syscall"
)

// Command represents an external command being prepared or run.
type Command struct {
	command           string
	args              []string
	cmd               *exec.Cmd
	stdoutPipe        io.ReadCloser
	stderrPipe        io.ReadCloser
	exitCode          int
	err               error
	waitGroup         sync.WaitGroup
	mu                sync.Mutex
	executed          bool
	workingDirectory  string
	stdoutLines       []string
	stdoutSubscribers []chan string
	stdoutMu          sync.Mutex
	stdoutClosed      bool
}

// New creates a new Command.
func New(command string, args ...string) *Command {
	return &Command{
		command:          command,
		args:             args,
		exitCode:         -1,
		workingDirectory: ".",
	}
}

func (c *Command) SetWorkingDirectory(dir string) *Command {
	c.workingDirectory = dir
	return c
}

// Execute starts the specified command but does not wait for it to complete.
func (c *Command) Execute() error {
	c.mu.Lock()

	if c.executed {
		c.mu.Unlock()
		return nil
	}

	c.cmd = exec.Command(c.command, c.args...)
	c.cmd.Dir = c.workingDirectory
	// Create pipes for stdout and stderr
	stdoutPipe, err := c.cmd.StdoutPipe()
	if err != nil {
		c.mu.Unlock()
		return err
	}
	c.stdoutPipe = stdoutPipe

	stderrPipe, err := c.cmd.StderrPipe()
	if err != nil {
		c.stdoutPipe.Close()
		c.mu.Unlock()
		return err
	}
	c.stderrPipe = stderrPipe

	// Start the command
	if err := c.cmd.Start(); err != nil {
		c.stdoutPipe.Close()
		c.stderrPipe.Close()
		c.mu.Unlock()
		return err
	}

	c.executed = true
	c.mu.Unlock()

	// Start goroutines to read stdout and stderr
	c.waitGroup.Add(2)
	go c.pipeToStdout(c.stdoutPipe)
	go c.pipeToStdout(c.stderrPipe)

	go func() {
		c.waitGroup.Wait()
		c.stdoutMu.Lock()
		defer c.stdoutMu.Unlock()
		c.stdoutClosed = true
		for _, sub := range c.stdoutSubscribers {
			close(sub)
		}
		c.stdoutSubscribers = nil
	}()

	return nil
}

// pipeToStdout reads from a pipe, buffers lines, and broadcasts to subscribers.
func (c *Command) pipeToStdout(pipe io.ReadCloser) {
	defer c.waitGroup.Done()
	defer pipe.Close()

	scanner := bufio.NewScanner(pipe)
	// Increase buffer size to 1MB to handle long lines
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		c.stdoutMu.Lock()
		c.stdoutLines = append(c.stdoutLines, line)
		for _, sub := range c.stdoutSubscribers {
			// Non-blocking send to prevent blocking the command execution
			select {
			case sub <- line:
			default:
				// Subscriber is slow, skip this line for them
			}
		}
		c.stdoutMu.Unlock()
	}

	if err := scanner.Err(); err != nil {
		// Log error if scanner failed (e.g. token too long)
		// We can't easily log to the application log here without importing "log",
		// but we can append to stdoutLines so it's visible in the UI
		errMsg := "Error reading output: " + err.Error()
		c.stdoutMu.Lock()
		c.stdoutLines = append(c.stdoutLines, errMsg)
		c.stdoutMu.Unlock()
	}
}

// StdoutChannel returns a channel that receives lines from standard output.
// Each call returns a new channel that will receive all past and future output.
func (c *Command) StdoutChannel() <-chan string {
	c.stdoutMu.Lock()
	defer c.stdoutMu.Unlock()

	newChan := make(chan string, len(c.stdoutLines)+100)

	// Replay history
	for _, line := range c.stdoutLines {
		newChan <- line
	}

	if c.stdoutClosed {
		close(newChan)
	} else {
		c.stdoutSubscribers = append(c.stdoutSubscribers, newChan)
	}

	return newChan
}

// Wait waits for the command to exit and all output to be processed.
func (c *Command) Wait() error {
	if c.cmd == nil {
		return nil
	}

	// Wait for the command to finish
	err := c.cmd.Wait()

	// Wait for all output readers to finish
	c.waitGroup.Wait()

	// Capture exit code
	c.mu.Lock()
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			if status, ok := exitError.Sys().(syscall.WaitStatus); ok {
				c.exitCode = status.ExitStatus()
			} else {
				c.exitCode = 1
			}
		} else {
			c.exitCode = 1
		}
		c.err = err
	} else {
		c.exitCode = 0
	}
	c.mu.Unlock()

	return err
}

// ExitCode returns the exit code of the command.
// Returns -1 if the command hasn't finished yet.
func (c *Command) ExitCode() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.exitCode
}

// Logs returns all output lines from stdout and stderr.
// This is a snapshot of the logs at the time of calling.
func (c *Command) Logs() []string {
	c.stdoutMu.Lock()
	defer c.stdoutMu.Unlock()

	// Return a copy to prevent external modification
	logs := make([]string, len(c.stdoutLines))
	copy(logs, c.stdoutLines)
	return logs
}
