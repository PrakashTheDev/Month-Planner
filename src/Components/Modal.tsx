import React from "react";

export default function Modal({ open, onClose, children }:any) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div style={{ textAlign: "right" }}>
          <button className="btn" onClick={onClose}>
            X
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
