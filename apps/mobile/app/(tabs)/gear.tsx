import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldCompass } from '@/components/field-compass';
import { FieldButton } from '@/components/field-button';
import { Colors, Nomad } from '@/constants/theme';
import { sitBriefing } from '@/src/gear-logic';
import { GEAR_GROUPS, unusedSuggestions, type GearGroup } from '@/src/gear-suggestions';
import { useFieldStore } from '@/src/store';

type GearTab = 'kit' | 'compass';

const RING = 72;
const STROKE = 7;

export default function GearScreen() {
  const gear = useFieldStore((state) => state.gear) ?? [];
  const weather = useFieldStore((state) => state.weather);
  const hunts = useFieldStore((state) => state.hunts);
  const activeHuntId = useFieldStore((state) => state.activeHuntId);
  const huntPlans = useFieldStore((state) => state.huntPlans);
  const toggleGear = useFieldStore((state) => state.toggleGear);
  const addGear = useFieldStore((state) => state.addGear);
  const addGearItems = useFieldStore((state) => state.addGearItems);
  const removeGear = useFieldStore((state) => state.removeGear);
  const applyGearTemplate = useFieldStore((state) => state.applyGearTemplate);
  const unpackAllGear = useFieldStore((state) => state.unpackAllGear);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<GearTab>('kit');
  const species =
    hunts.find((hunt) => hunt.id === activeHuntId)?.species ?? huntPlans[0]?.species;
  const briefing = useMemo(
    () => sitBriefing({ gear, weather, species }),
    [gear, weather, species],
  );
  const grouped = useMemo(() => {
    const buckets = new Map<GearGroup, typeof gear>();
    for (const group of GEAR_GROUPS) buckets.set(group, []);
    for (const item of [...gear].sort((left, right) => Number(left.packed) - Number(right.packed) || left.sort - right.sort)) {
      const group = item.group ?? 'Custom';
      const list = buckets.get(group) ?? [];
      list.push(item);
      buckets.set(group, list);
    }
    return GEAR_GROUPS.map((group) => ({
      group,
      items: buckets.get(group) ?? [],
    })).filter((row) => row.items.length > 0);
  }, [gear]);
  const chips = useMemo(
    () => unusedSuggestions(gear.map((item) => item.name), draft, draft.trim() ? 4 : 3),
    [draft, gear],
  );
  const readyPct = Math.round(briefing.ready * 100);

  const addItem = (name: string) => {
    addGear(name);
    setDraft('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>NOMAD</Text>
          <Text style={styles.title}>Field kit</Text>
          <Text style={styles.subtitle}>
            {tab === 'kit'
              ? gear.length === 0
                ? 'Mission list empty. Load a core sit or add from conditions.'
                : `Sit ready ${readyPct}% · ${briefing.packed}/${briefing.total} packed`
              : 'Heading, coordinates, and a bearing back to the truck if you marked Park here.'}
          </Text>
        </View>

        <View style={styles.tabs}>
          <FieldButton
            accessibilityLabel="Kit"
            style={[styles.tab, tab === 'kit' && styles.tabOn]}
            onPress={() => setTab('kit')}>
            <Text style={[styles.tabLabel, tab === 'kit' && styles.tabLabelOn]}>Kit</Text>
          </FieldButton>
          <FieldButton
            accessibilityLabel="Compass"
            style={[styles.tab, tab === 'compass' && styles.tabOn]}
            onPress={() => setTab('compass')}>
            <Text style={[styles.tabLabel, tab === 'compass' && styles.tabLabelOn]}>Compass</Text>
          </FieldButton>
        </View>

        {tab === 'kit' ? (
          <>
            <View style={styles.brief}>
              <View style={styles.ringWrap}>
                <View style={styles.ringTrack} />
                <View style={styles.ringHole}>
                  <Text style={styles.ringValue}>{readyPct}</Text>
                  <Text style={styles.ringUnit}>ready</Text>
                </View>
              </View>
              <View style={styles.briefCopy}>
                <Text style={styles.briefKicker}>Field readiness</Text>
                <Text style={styles.briefTitle}>
                  {briefing.essentialTotal === 0
                    ? 'Build your sit kit'
                    : `${briefing.packedEssentials} of ${briefing.essentialTotal} essentials packed`}
                </Text>
                <View style={styles.readyBar}>
                  <View style={[styles.readyFill, { width: `${readyPct}%` }]} />
                </View>
                <View style={styles.condRow}>
                  {briefing.conditions.length === 0 ? (
                    <Text style={styles.condEmpty}>Conditions quiet</Text>
                  ) : (
                    briefing.conditions.map((item) => (
                      <View key={item.id} style={styles.cond}>
                        <Text style={styles.condLabel}>{item.label}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>

            {gear.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>Your kit is empty</Text>
                <Text style={styles.empty}>
                  Load a core sit checklist, then tick items as you pack. Add custom gear anytime.
                </Text>
                <FieldButton
                  accessibilityLabel="Load core sit kit"
                  style={styles.primaryCta}
                  onPress={() => applyGearTemplate()}>
                  <Text style={styles.primaryCtaLabel}>Load core sit kit</Text>
                </FieldButton>
              </View>
            ) : null}

            <View style={styles.addRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add kit item"
                placeholderTextColor={Colors.dark.muted}
                style={styles.input}
                onSubmitEditing={() => addItem(draft)}
              />
              <FieldButton
                accessibilityLabel="Add gear"
                style={styles.addBtn}
                onPress={() => addItem(draft)}>
                <Text style={styles.addLabel}>Add</Text>
              </FieldButton>
            </View>

            {gear.length > 0
              ? grouped.map((section) => {
                  const packed = section.items.filter((item) => item.packed).length;
                  return (
                    <View key={section.group} style={styles.group}>
                      <View style={styles.groupHead}>
                        <Text style={styles.groupTitle}>{section.group}</Text>
                        <Text style={styles.groupMeta}>
                          {packed}/{section.items.length}
                        </Text>
                      </View>
                      {section.items.map((item) => (
                        <View key={item.id} style={styles.row}>
                          <FieldButton
                            accessibilityLabel={item.packed ? `Unpack ${item.name}` : `Pack ${item.name}`}
                            style={styles.checkHit}
                            onPress={() => toggleGear(item.id)}>
                            <View style={[styles.box, item.packed && styles.boxPacked]}>
                              {item.packed ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
                            </View>
                            <View style={styles.rowCopy}>
                              <Text style={[styles.name, item.packed && styles.namePacked]}>{item.name}</Text>
                              {item.essential ? <Text style={styles.flag}>ESSENTIAL</Text> : null}
                            </View>
                          </FieldButton>
                          <FieldButton
                            accessibilityLabel={`Remove ${item.name}`}
                            style={styles.trash}
                            onPress={() => removeGear(item.id)}>
                            <MaterialIcons name="delete-outline" size={20} color={Nomad.mist} />
                          </FieldButton>
                        </View>
                      ))}
                    </View>
                  );
                })
              : null}

            {briefing.packed > 0 ? (
              <FieldButton
                accessibilityLabel="Unpack all kit items"
                style={styles.template}
                onPress={() => unpackAllGear()}>
                <Text style={styles.templateLabel}>Unpack all</Text>
              </FieldButton>
            ) : null}

            {briefing.suggestions.length > 0 ? (
              <View style={styles.suggestBlock}>
                <Text style={styles.suggestKicker}>{draft.trim() ? 'Matches' : 'Add for this sit'}</Text>
                <View style={styles.chips}>
                  {(draft.trim() ? chips : briefing.suggestions).map((item) => (
                    <FieldButton
                      key={item.name}
                      accessibilityLabel={`Add ${item.name}`}
                      style={styles.chip}
                      onPress={() => addItem(item.name)}>
                      <Text style={styles.chipLabel}>{item.name}</Text>
                    </FieldButton>
                  ))}
                </View>
                {!draft.trim()
                  ? briefing.suggestions.map((item) => (
                      <Text key={`${item.name}-reason`} style={styles.reason}>
                        {item.name} · {item.reason}
                      </Text>
                    ))
                  : null}
                {!draft.trim() ? (
                  <FieldButton
                    accessibilityLabel="Add sit extras"
                    style={styles.sitBtn}
                    onPress={() => addGearItems(briefing.suggestions)}>
                    <Text style={styles.sitLabel}>Add sit extras</Text>
                  </FieldButton>
                ) : null}
              </View>
            ) : null}
            {gear.length > 0 ? (
              <FieldButton
                accessibilityLabel="Add remaining core sit kit"
                style={styles.template}
                onPress={() => applyGearTemplate()}>
                <Text style={styles.templateLabel}>Add remaining core sit kit</Text>
              </FieldButton>
            ) : null}
          </>
        ) : tab === 'compass' ? (
          <FieldCompass />
        ) : (
          (() => {
            const _exhaustive: never = tab;
            return _exhaustive;
          })()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Nomad.ink,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Nomad.line,
  },
  kicker: {
    color: Nomad.rust,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    color: Nomad.bone,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: Colors.dark.muted,
    fontSize: 14,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: Nomad.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: {
    backgroundColor: Nomad.rust,
    borderColor: Nomad.rust,
  },
  tabLabel: {
    color: Nomad.bone,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  tabLabelOn: {
    color: '#fff',
  },
  brief: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: 'rgba(8,16,24,0.72)',
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: STROKE,
    borderColor: 'rgba(103,232,249,0.22)',
  },
  ringHole: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    color: Nomad.bone,
    fontSize: 20,
    fontWeight: '800',
  },
  ringUnit: {
    color: Nomad.mist,
    fontSize: 10,
    letterSpacing: 1,
  },
  readyBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(103,232,249,0.12)',
    overflow: 'hidden',
    marginTop: 6,
  },
  readyFill: {
    height: '100%',
    backgroundColor: Nomad.rust,
  },
  briefCopy: {
    flex: 1,
    gap: 4,
  },
  briefKicker: {
    color: '#67e8f9',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  briefTitle: {
    color: Nomad.bone,
    fontSize: 16,
    fontWeight: '700',
  },
  condRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  cond: {
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  condLabel: {
    color: '#67e8f9',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  condEmpty: {
    color: Nomad.mist,
    fontSize: 12,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Nomad.steel,
    color: Nomad.bone,
    paddingHorizontal: 12,
  },
  addBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Nomad.rust,
    justifyContent: 'center',
  },
  addLabel: {
    color: '#fff',
    fontWeight: '800',
  },
  group: {
    marginBottom: 12,
  },
  groupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  groupTitle: {
    color: '#67e8f9',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  groupMeta: {
    color: Nomad.mist,
    fontSize: 11,
  },
  suggestBlock: {
    marginTop: 18,
    gap: 6,
  },
  suggestKicker: {
    color: Nomad.mist,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: 'transparent',
  },
  chipLabel: {
    color: Nomad.mist,
    fontSize: 11,
    fontWeight: '600',
  },
  reason: {
    color: Colors.dark.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  sitBtn: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: Nomad.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  sitLabel: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  template: {
    minHeight: 22,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  templateLabel: {
    color: Nomad.mist,
    fontSize: 11,
    fontWeight: '600',
  },
  empty: {
    color: Colors.dark.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyBlock: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: 'rgba(8,16,24,0.55)',
    gap: 8,
  },
  emptyTitle: {
    color: Nomad.bone,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  primaryCta: {
    minHeight: 48,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: Nomad.rust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaLabel: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    minHeight: 52,
  },
  checkHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    width: '100%',
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.dark.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxPacked: {
    backgroundColor: Nomad.rust,
    borderColor: Nomad.rust,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 16,
    flex: 1,
  },
  namePacked: {
    color: Colors.dark.muted,
    textDecorationLine: 'line-through',
  },
  flag: {
    color: '#67e8f9',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  trash: {
    width: 40,
    height: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
