"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface NoteTarget {
  bookId: string
  title: string
  author: string
  /** "finished" when it opens because the book was just marked as read. */
  reason: "finished" | "edit"
}

interface BookNoteDialogProps {
  target: NoteTarget | null
  existingNote: string
  onSave: (bookId: string, note: string) => void
  onClose: () => void
}

/** Asks for a short note when a book is finished, and edits that note later. */
export default function BookNoteDialog({ target, existingNote, onSave, onClose }: BookNoteDialogProps) {
  const [text, setText] = useState("")

  useEffect(() => {
    if (target) setText(existingNote)
  }, [target, existingNote])

  const finished = target?.reason === "finished"

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl leading-tight">
            {finished ? "Add a note?" : "Your note"}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-700">
            <span className="font-bold text-gray-900">{target?.title}</span> by {target?.author}
          </DialogDescription>
        </DialogHeader>
        <label htmlFor="book-note" className="text-base font-bold text-gray-900">
          What do you want to remember about it?
        </label>
        <textarea
          id="book-note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="A character, a scene, who recommended it"
          className="w-full rounded-xl border-2 border-gray-300 p-3 text-lg text-gray-900 placeholder:text-gray-500 focus:border-gray-900 focus:outline-none"
          autoFocus
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" className="tap-target text-base font-bold text-gray-700" onClick={onClose}>
            {finished ? "Skip" : "Cancel"}
          </Button>
          <Button
            className="tap-target bg-gray-900 text-base font-bold text-white hover:bg-black"
            onClick={() => {
              if (target) onSave(target.bookId, text.trim())
              onClose()
            }}
          >
            Save note
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
