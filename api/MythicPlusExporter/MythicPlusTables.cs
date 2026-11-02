using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace MythicPlusExporter;

public sealed record MythicPlusTables(
    string Fingerprint,
    IReadOnlyList<MythicPlusSpec> Specs,
    IReadOnlyList<MythicPlusPlayer> Players
)
{
    public static MythicPlusTables Extend(MythicPlusTables? previous, MythicPlusDataset dataset)
    {
        if (previous is null)
        {
            return new(
                FingerprintOf(dataset.Specs, dataset.Players),
                dataset.Specs,
                dataset.Players
            );
        }

        var current = dataset.Players.ToDictionary(player => (player.Realm, player.Name));
        var known = previous.Players.Select(player => (player.Realm, player.Name)).ToHashSet();
        var players = previous
            .Players.Select(player =>
                current.GetValueOrDefault((player.Realm, player.Name)) ?? player
            )
            .Concat(dataset.Players.Where(player => !known.Contains((player.Realm, player.Name))))
            .ToList();
        var specs = previous.Specs.Concat(dataset.Specs.Except(previous.Specs)).ToList();

        return new(previous.Fingerprint, specs, players);
    }

    public static string FingerprintOf(
        IReadOnlyList<MythicPlusSpec> specs,
        IReadOnlyList<MythicPlusPlayer> players
    )
    {
        var text = new StringBuilder();
        foreach (var spec in specs)
        {
            text.Append("spec\t")
                .Append(spec.ClassId.ToString(CultureInfo.InvariantCulture))
                .Append('\t')
                .Append(spec.Name)
                .Append('\t')
                .Append(spec.Role)
                .Append('\n');
        }
        foreach (var player in players)
        {
            text.Append("player\t")
                .Append(player.Realm)
                .Append('\t')
                .Append(player.Name)
                .Append('\n');
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString()));
        return Convert.ToHexStringLower(hash)[..12];
    }
}
