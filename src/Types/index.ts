export type Category =  "To Do" | "In Progress" | "Review" | "Completed";

export interface Task {
  id: string;
  title: string;
  start: string;
  end: string;
  category: Category;
}
