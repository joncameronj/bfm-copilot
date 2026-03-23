-- Add INSERT policy for recommendation_reasoning table.
-- Previously only SELECT policies existed, blocking the app from creating
-- reasoning records during analysis finalization.

CREATE POLICY "Practitioners insert reasoning for own recommendations"
ON public.recommendation_reasoning
FOR INSERT WITH CHECK (
    protocol_recommendation_id IN (
        SELECT pr.id FROM public.protocol_recommendations pr
        JOIN public.diagnostic_analyses da ON pr.diagnostic_analysis_id = da.id
        WHERE da.practitioner_id = auth.uid()
    )
);
