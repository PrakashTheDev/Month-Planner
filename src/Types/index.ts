export type Category =  "To Do" | "In Progress" | "Review" | "Completed";

export interface Task {
  id: string;
  title: string;
  start: string; // yyyy-MM-dd
  end: string;   // yyyy-MM-dd (inclusive)
  category: Category;
}
