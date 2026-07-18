import React from "react";

interface GreetingProps {
  title?: string;
  subtitle?: string;
}

export default function Greeting({
  title = "Hello, what do you want to learn today?",
  subtitle = "Explore the Mezon Knowledge Hub",
}: GreetingProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 my-10">
      <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 text-center">
        {title}
      </h1>
      <p className="text-lg text-[rgb(var(--color-text-muted))] text-center">
        {subtitle}
      </p>
    </div>
  );
}
