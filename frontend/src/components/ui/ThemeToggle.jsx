import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className={`btn-icon ${className}`}
      aria-label={isDark ? "Use light theme" : "Use dark theme"}
      title={isDark ? "Use light theme" : "Use dark theme"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
