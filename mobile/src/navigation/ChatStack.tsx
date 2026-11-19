import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import ChatListScreen from '../features/chat/ChatListScreen';
import ConversationScreen from '../features/chat/ConversationScreen';
import ChatSearchScreen from '../features/chat/ChatSearchScreen';
import NewChatScreen from '../features/chat/NewChatScreen';
import CreateGroupScreen from '../features/chat/CreateGroupScreen';
import GroupInfoScreen from '../features/chat/GroupInfoScreen';
import ChatReportsScreen from '../features/chat/ChatReportsScreen';

export type ChatStackParamList = {
  ChatList: undefined;
  Conversation: { conversationId: string; title?: string; jumpToId?: string };
  ChatSearch: { conversationId: string };
  NewChat: { initialUserId?: string } | undefined;
  CreateGroup: undefined;
  GroupInfo: { conversationId: string };
  ChatReports: undefined;
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // every chat screen draws its own gradient header
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ChatList" component={ChatListScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="ChatSearch" component={ChatSearchScreen} />
      <Stack.Screen name="NewChat" component={NewChatScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen name="ChatReports" component={ChatReportsScreen} />
    </Stack.Navigator>
  );
}
