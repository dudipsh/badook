interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'loading-sm',
  md: 'loading-md',
  lg: 'loading-lg',
};

const Spinner = ({ size = 'md' }: SpinnerProps) => {
  return (
    <div className="flex items-center justify-center p-8">
      <span className={`loading loading-spinner ${sizeClasses[size]}`} />
    </div>
  );
};

export default Spinner;
