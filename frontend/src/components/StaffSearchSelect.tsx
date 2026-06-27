import { useEffect, useMemo, useRef, useState } from "react";

export type StaffSelectOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type StaffSearchSelectProps = {
  value: string;
  onChange: (value: string) => void;
  staffUsers: StaffSelectOption[];
  placeholder: string;
  disabled?: boolean;
};

export const StaffSearchSelect = ({
  value,
  onChange,
  staffUsers,
  placeholder,
  disabled = false
}: StaffSearchSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedStaff = staffUsers.find((staffUser) => staffUser.id === value) ?? null;

  const filteredStaff = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return staffUsers;
    }

    return staffUsers.filter((staffUser) =>
      [staffUser.name, staffUser.email, staffUser.role].some((field) =>
        field.toLowerCase().includes(normalizedSearch)
      )
    );
  }, [search, staffUsers]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  const chooseStaff = (staffUserId: string) => {
    onChange(staffUserId);
    setSearch("");
    setIsOpen(false);
  };

  return (
    <div className="staff-search-select" ref={containerRef}>
      <button
        type="button"
        className="staff-search-trigger"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selectedStaff ? `${selectedStaff.name} (${selectedStaff.role})` : placeholder}</span>
      </button>

      {isOpen ? (
        <div className="staff-search-menu">
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff"
          />
          <button type="button" className="staff-search-option" onClick={() => chooseStaff("")}>
            {placeholder}
          </button>
          {filteredStaff.length ? (
            filteredStaff.map((staffUser) => (
              <button
                type="button"
                className="staff-search-option"
                key={staffUser.id}
                onClick={() => chooseStaff(staffUser.id)}
              >
                <strong>{staffUser.name}</strong>
                <small>
                  {staffUser.role} | {staffUser.email}
                </small>
              </button>
            ))
          ) : (
            <p>No staff match this search.</p>
          )}
        </div>
      ) : null}
    </div>
  );
};
