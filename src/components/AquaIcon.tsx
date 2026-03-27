interface AquaIconProps {
  icon: React.ElementType;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: string;
  className?: string;
}

const SIZES = {
  xs: { container: "w-6 h-6", icon: "w-3 h-3" },
  sm: { container: "w-8 h-8", icon: "w-4 h-4" },
  md: { container: "w-10 h-10", icon: "w-5 h-5" },
  lg: { container: "w-12 h-12", icon: "w-6 h-6" },
  xl: { container: "w-14 h-14", icon: "w-7 h-7" },
};

const AquaIcon = ({ icon: Icon, size = "md", color, className = "" }: AquaIconProps) => {
  const s = SIZES[size];

  return (
    <div
      className={`${s.container} aqua-icon flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        background: color
          ? `linear-gradient(145deg, ${color}, ${color}cc)`
          : "linear-gradient(145deg, hsl(250 80% 60%), hsl(280 75% 55%))",
      }}
    >
      <Icon className={`${s.icon} text-white relative z-10 drop-shadow-sm`} strokeWidth={2} />
    </div>
  );
};

export default AquaIcon;
