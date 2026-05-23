package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const (
	cyan   = "\033[36m"
	green  = "\033[32m"
	red    = "\033[31m"
	yellow = "\033[33m"
	reset  = "\033[0m"
)

const regKey  = `Software\Microsoft\Windows\CurrentVersion\Run`
const regName = "EireneSetup"

func enableVT100() {
	stdout := windows.Handle(os.Stdout.Fd())
	var mode uint32
	windows.GetConsoleMode(stdout, &mode)
	windows.SetConsoleMode(stdout, mode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING)
}

func banner() {
	fmt.Println()
	fmt.Println(cyan + `  ███████╗██╗██████╗ ███████╗███╗   ██╗███████╗` + reset)
	fmt.Println(cyan + `  ██╔════╝██║██╔══██╗██╔════╝████╗  ██║██╔════╝` + reset)
	fmt.Println(cyan + `  █████╗  ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ` + reset)
	fmt.Println(cyan + `  ██╔══╝  ██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══╝  ` + reset)
	fmt.Println(cyan + `  ███████╗██║██║  ██║███████╗██║ ╚████║███████╗ ` + reset)
	fmt.Println(cyan + `  ╚══════╝╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚══════╝` + reset)
	fmt.Println()
	fmt.Println(yellow + `  Private browsing. Ad-free. Your voice.` + reset)
	fmt.Println()
}

func ok(msg string)   { fmt.Println(green + "  ✓ " + msg + reset) }
func fail(msg string) { fmt.Println(red + "  ✗ " + msg + reset) }
func info(msg string) { fmt.Println("    " + msg) }
func step(msg string) { fmt.Println(cyan + msg + reset) }

func pause() {
	fmt.Println()
	fmt.Print("  Press Enter to continue...")
	fmt.Scanln()
}

func runCmd(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.CombinedOutput()
	clean := strings.ReplaceAll(string(out), "\x00", "")
	return strings.TrimSpace(clean), err
}

func exePath() string {
	exe, _ := os.Executable()
	return filepath.Clean(exe)
}

func addRunKey() {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, regKey, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer k.Close()
	k.SetStringValue(regName, `"`+exePath()+`"`)
}

func removeRunKey() {
	k, err := registry.OpenKey(registry.CURRENT_USER, regKey, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer k.Close()
	k.DeleteValue(regName)
}

func checkWSL() bool {
	step("[1/2] Checking WSL2 + Ubuntu...")

	// Check if Ubuntu already installed
	out, _ := runCmd("wsl", "--list", "--quiet")
	for _, line := range strings.Split(out, "\n") {
		clean := strings.TrimSpace(line)
		if strings.EqualFold(clean, "Ubuntu") {
			ok("Ubuntu WSL2 ready")
			return true
		}
	}

	// Not found — install WSL2 + Ubuntu in one command
	info("Installing WSL2 and Ubuntu...")
	info("This may take a few minutes...")
	fmt.Println()

	cmd := exec.Command("wsl", "--install", "-d", "Ubuntu")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		// wsl --install often returns non-zero even on success
		// check if Ubuntu is now present
		out2, _ := runCmd("wsl", "--list", "--quiet")
		for _, line := range strings.Split(out2, "\n") {
			if strings.EqualFold(strings.TrimSpace(line), "Ubuntu") {
				ok("Ubuntu installed")
				break
			}
		}
	}

	fmt.Println()
	fmt.Println(yellow + "  WSL2 and Ubuntu installed." + reset)
	fmt.Println(yellow + "  A restart is required to continue." + reset)
	fmt.Println()
	info("Eirene Setup will continue automatically after restart.")
	fmt.Println()

	// Register to auto-run after reboot
	addRunKey()

	// Initiate restart in 15 seconds
	exec.Command("shutdown", "/r", "/t", "15",
		"/c", "Eirene: Restarting to complete WSL2 setup...").Run()

	fmt.Println(yellow + "  Restarting in 15 seconds..." + reset)
	fmt.Println()
	pause()
	return false
}

func runSetup() bool {
	step("[2/2] Running Eirene setup...")
	fmt.Println()
	fmt.Println("    " + yellow + "Tip: right-click to paste text in this window." + reset)
	fmt.Println()

	cmd := exec.Command("wsl", "-d", "Ubuntu", "--exec",
		"bash", "-c",
		"export TERM=xterm; curl -sSL https://eirene.run.place/setup -o /tmp/eirene-setup.sh && bash /tmp/eirene-setup.sh")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	err := cmd.Run()
	if err != nil {
		fmt.Println()
		fail("Setup encountered an error. Check the output above.")
		pause()
		return false
	}
	return true
}

func main() {
	enableVT100()
	// Remove run key if we were auto-started after reboot
	removeRunKey()

	banner()
	time.Sleep(100 * time.Millisecond)

	if !checkWSL() {
		os.Exit(0)
	}
	fmt.Println()

	if !runSetup() {
		os.Exit(1)
	}

	fmt.Println()
	ok("Eirene is ready!")
	fmt.Println()
	pause()
}
