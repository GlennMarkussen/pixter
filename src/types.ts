export type Player = {
  id: number;
  name: string;
  color: string;
};

export type GenerateImageResponse = {
  imageUrl: string;
  model: string;
};

export type JudgeResponse = {
  correct: boolean;
  rationale: string;
};
