namespace MythicPlusExporter;

public static class MythicPlusScore
{
    private const double BaseScore = 50;
    private const double PerLevel = 7.5;
    private const double TimedBonus = 12.5;
    private const double OverTimePenalty = 20;

    private const long MaxScoredTimerPermille = 1400;

    public static double Calculate(int keyLevel, long clearTimeMilliseconds, int timerSeconds)
    {
        if (
            keyLevel <= 0
            || clearTimeMilliseconds <= 0
            || timerSeconds <= 0
            || IsTooSlowToScore(clearTimeMilliseconds, timerSeconds)
        )
        {
            return 0;
        }

        var timerRatio = clearTimeMilliseconds / (timerSeconds * 1000d);
        var score = IsTimed(clearTimeMilliseconds, timerSeconds)
            ? BaseScore + PerLevel * keyLevel + TimedBonus * (1 - timerRatio)
            : BaseScore + PerLevel * (keyLevel - 1) - OverTimePenalty * (timerRatio - 1);

        return Math.Round(score, 1, MidpointRounding.AwayFromZero);
    }

    public static bool IsTimed(long clearTimeMilliseconds, int timerSeconds) =>
        clearTimeMilliseconds <= timerSeconds * 1000L;

    public static bool IsTooSlowToScore(long clearTimeMilliseconds, int timerSeconds) =>
        clearTimeMilliseconds > timerSeconds * MaxScoredTimerPermille;
}
