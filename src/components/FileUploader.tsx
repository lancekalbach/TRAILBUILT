import { useRef } from 'react'

type FileUploaderProps = {
  label: string
  accept: string
  onFileSelected: (file: File) => void
  disabled?: boolean
  variant?: 'primary' | 'ghost'
}

export function FileUploader({
  label,
  accept,
  onFileSelected,
  disabled,
  variant = 'primary',
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelected(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-ghost'}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
    </>
  )
}
